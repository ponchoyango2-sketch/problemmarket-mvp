const express = require('express');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const db = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function normalizeReward(reward) {
  let amount;
  let currency = 'USD';

  if (typeof reward === 'number' || typeof reward === 'string') {
    amount = Number(reward);
  } else if (reward && typeof reward === 'object') {
    amount = Number(reward.amount);
    currency = String(reward.currency || 'USD').toUpperCase();
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'reward must be greater than 0' };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: 'currency must be a 3-letter code' };
  }

  return { amount: Math.round(amount * 100) / 100, currency };
}

function calculatePublishFee(amount) {
  return Math.max(5, Math.round(amount * 0.05 * 100) / 100);
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function getFrontendBaseUrl() {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/+$/, '');
  }
  const firstCorsOrigin = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .find(Boolean);
  return (firstCorsOrigin || 'http://localhost:3000').replace(/\/+$/, '');
}

function webhookLog(message, meta = {}) {
  console.info('[stripe-webhook]', message, meta);
}

function webhookWarn(message, meta = {}) {
  console.warn('[stripe-webhook]', message, meta);
}

async function upsertWebhookEventStatus(eventId, fields) {
  const {
    eventType = null,
    sessionId = null,
    paymentIntentId = null,
    customerEmail = null,
    status = null,
    errorMessage = null,
  } = fields;

  await db.query(
    `INSERT INTO stripe_webhook_events(
       event_id,
       event_type,
       session_id,
       payment_intent_id,
       customer_email,
       status,
       error_message,
       received_at,
       processed_at
     )
     VALUES(
       $1,
       COALESCE($2, 'unknown'),
       $3,
       $4,
       $5,
       COALESCE($6, 'received'),
       $7,
       now(),
       CASE WHEN $6 IN ('processed', 'failed', 'ignored', 'duplicate') THEN now() ELSE NULL END
     )
     ON CONFLICT (event_id) DO UPDATE SET
       event_type = COALESCE(EXCLUDED.event_type, stripe_webhook_events.event_type),
       session_id = COALESCE(EXCLUDED.session_id, stripe_webhook_events.session_id),
       payment_intent_id = COALESCE(EXCLUDED.payment_intent_id, stripe_webhook_events.payment_intent_id),
       customer_email = COALESCE(EXCLUDED.customer_email, stripe_webhook_events.customer_email),
       status = COALESCE(EXCLUDED.status, stripe_webhook_events.status),
       error_message = COALESCE(EXCLUDED.error_message, stripe_webhook_events.error_message),
       processed_at = CASE
         WHEN EXCLUDED.status IN ('processed', 'failed', 'ignored', 'duplicate')
           THEN now()
         ELSE stripe_webhook_events.processed_at
       END`,
    [eventId, eventType, sessionId, paymentIntentId, customerEmail, status, errorMessage]
  );
}

router.post('/create-checkout-session', verifyToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const { title, description, reward } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    return res.status(400).json({ error: 'title must be at least 5 characters' });
  }

  const normalizedReward = normalizeReward(reward);
  if (normalizedReward.error) {
    return res.status(400).json({ error: normalizedReward.error });
  }

  const rewardAmount = normalizedReward.amount;
  const rewardCurrency = normalizedReward.currency;
  const fee = calculatePublishFee(rewardAmount);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const rewardInsert = await client.query(
      'INSERT INTO rewards(amount, currency) VALUES($1, $2) RETURNING id',
      [rewardAmount, rewardCurrency]
    );

    const problemInsert = await client.query(
      `INSERT INTO problems(publisher_id, title, description, reward_id, status, fee_paid)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.userId,
        title.trim().slice(0, 200),
        String(description || '').slice(0, 5000),
        rewardInsert.rows[0].id,
        'pending_payment',
        false,
      ]
    );

    const problemId = problemInsert.rows[0].id;
    const frontendBase = getFrontendBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: rewardCurrency.toLowerCase(),
            unit_amount: toCents(fee),
            product_data: {
              name: 'Problem publishing fee',
              description: 'Non-refundable fee required to publish this challenge.',
            },
          },
        },
      ],
      metadata: {
        problemId,
        userId: req.user.userId,
      },
      payment_intent_data: {
        metadata: {
          problemId,
          userId: req.user.userId,
        },
      },
      success_url: `${frontendBase}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/payments/cancel?problem_id=${problemId}`,
    });

    await client.query('UPDATE problems SET stripe_session_id = $1 WHERE id = $2', [session.id, problemId]);
    await client.query('COMMIT');

    res.status(201).json({
      url: session.url,
      sessionId: session.id,
      fee,
      feeCurrency: rewardCurrency,
      reward: rewardAmount,
      message: 'Publishing fee created. This payment is non-refundable.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create-checkout-session error:', err.message);
    res.status(500).json({ error: 'Could not create payment session' });
  } finally {
    client.release();
  }
});

router.get('/session-status', verifyToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const sessionId = String(req.query.session_id || '').trim();
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'valid session_id is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Prevent users from checking someone else's payment session.
    if (session.metadata?.userId && session.metadata.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden payment session' });
    }

    let problem = null;
    const problemIdFromMetadata = session.metadata?.problemId || null;

    if (problemIdFromMetadata) {
      const byId = await db.query(
        `SELECT p.id, p.title, p.status, p.fee_paid, r.amount, r.currency
         FROM problems p
         LEFT JOIN rewards r ON p.reward_id = r.id
         WHERE p.id = $1 AND p.publisher_id = $2`,
        [problemIdFromMetadata, req.user.userId]
      );
      if (byId.rowCount > 0) {
        problem = byId.rows[0];
      }
    }

    if (!problem) {
      const bySession = await db.query(
        `SELECT p.id, p.title, p.status, p.fee_paid, r.amount, r.currency
         FROM problems p
         LEFT JOIN rewards r ON p.reward_id = r.id
         WHERE p.stripe_session_id = $1 AND p.publisher_id = $2`,
        [sessionId, req.user.userId]
      );
      if (bySession.rowCount > 0) {
        problem = bySession.rows[0];
      }
    }

    const openLikeStatuses = ['public', 'published', 'open', 'awarded', 'closed'];
    const isPublished = !!problem && openLikeStatuses.includes(problem.status) && !!problem.fee_paid;

    return res.json({
      sessionId,
      checkoutStatus: session.status || null,
      paymentStatus: session.payment_status || null,
      isPublished,
      problem: problem
        ? {
            id: problem.id,
            title: problem.title,
            status: problem.status,
            feePaid: problem.fee_paid,
            rewardAmount: Number(problem.amount || 0),
            currency: problem.currency || 'USD',
          }
        : null,
    });
  } catch (err) {
    if (err.code === 'resource_missing') {
      return res.status(404).json({ error: 'Stripe session not found' });
    }
    console.error('session-status error:', err.message);
    return res.status(500).json({ error: 'Could not fetch payment status' });
  }
});

async function processCheckoutSessionCompleted(event) {
  const session = event.data?.object;
  const eventId = event.id;
  const sessionId = session?.id || null;
  const paymentIntentId = session?.payment_intent ? String(session.payment_intent) : null;
  const customerEmail = session?.customer_details?.email || session?.customer_email || null;
  const metadata = session?.metadata || {};
  const problemId = metadata.problemId || metadata.challengeId || null;

  webhookLog('event_received', {
    eventId,
    eventType: event.type,
    sessionId,
    customerEmail,
    problemId,
  });

  // Idempotency guard by Stripe event id.
  const firstInsert = await db.query(
    `INSERT INTO stripe_webhook_events(event_id, event_type, session_id, payment_intent_id, customer_email, status, received_at)
     VALUES($1, $2, $3, $4, $5, 'received', now())
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, event.type, sessionId, paymentIntentId, customerEmail]
  );

  if (firstInsert.rowCount === 0) {
    webhookWarn('duplicate_event_ignored', { eventId, sessionId });
    return;
  }

  // Only process fully paid checkout sessions.
  if (session?.payment_status !== 'paid') {
    webhookWarn('session_not_paid', {
      eventId,
      sessionId,
      paymentStatus: session?.payment_status || 'unknown',
    });
    await upsertWebhookEventStatus(eventId, {
      eventType: event.type,
      sessionId,
      paymentIntentId,
      customerEmail,
      status: 'ignored',
      errorMessage: 'checkout session is not paid',
    });
    return;
  }

  if (!problemId) {
    webhookWarn('missing_problem_metadata', { eventId, sessionId });
    await upsertWebhookEventStatus(eventId, {
      eventType: event.type,
      sessionId,
      paymentIntentId,
      customerEmail,
      status: 'ignored',
      errorMessage: 'missing problemId/challengeId in metadata',
    });
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT p.id, p.title, p.status, p.fee_paid, p.stripe_session_id, r.amount, r.currency
       FROM problems p
       JOIN rewards r ON p.reward_id = r.id
       WHERE p.id = $1
       FOR UPDATE`,
      [problemId]
    );

    if (existing.rowCount === 0) {
      await client.query(
        `UPDATE stripe_webhook_events
         SET status = 'ignored',
             error_message = $2,
             processed_at = now()
         WHERE event_id = $1`,
        [eventId, 'problem not found']
      );
      await client.query('COMMIT');
      webhookWarn('problem_not_found_ignored', { eventId, problemId, sessionId });
      return;
    }

    const problem = existing.rows[0];
    const expectedFeeCents = toCents(calculatePublishFee(Number(problem.amount)));
    const paidCents = Number(session.amount_total || 0);
    const paidCurrency = String(session.currency || '').toUpperCase();
    const expectedCurrency = String(problem.currency || 'USD').toUpperCase();

    if (problem.stripe_session_id && sessionId && problem.stripe_session_id !== sessionId) {
      await client.query(
        `UPDATE stripe_webhook_events
         SET status = 'failed',
             error_message = $2,
             processed_at = now()
         WHERE event_id = $1`,
        [eventId, `session mismatch: expected ${problem.stripe_session_id}, got ${sessionId}`]
      );
      await client.query('COMMIT');
      webhookWarn('session_mismatch', {
        eventId,
        problemId,
        expectedSessionId: problem.stripe_session_id,
        gotSessionId: sessionId,
      });
      return;
    }

    if (paidCurrency && paidCurrency !== expectedCurrency) {
      await client.query(
        `UPDATE stripe_webhook_events
         SET status = 'failed',
             error_message = $2,
             processed_at = now()
         WHERE event_id = $1`,
        [eventId, `currency mismatch: expected ${expectedCurrency}, got ${paidCurrency}`]
      );
      await client.query('COMMIT');
      webhookWarn('currency_mismatch', {
        eventId,
        problemId,
        expectedCurrency,
        paidCurrency,
      });
      return;
    }

    if (paidCents < expectedFeeCents) {
      await client.query(
        `UPDATE stripe_webhook_events
         SET status = 'failed',
             error_message = $2,
             processed_at = now()
         WHERE event_id = $1`,
        [eventId, `amount mismatch: expected >= ${expectedFeeCents}, got ${paidCents}`]
      );
      await client.query('COMMIT');
      webhookWarn('amount_mismatch', { eventId, problemId, expectedFeeCents, paidCents });
      return;
    }

    webhookLog('payment_validated', {
      eventId,
      problemId,
      sessionId,
      expectedFeeCents,
      paidCents,
      currency: expectedCurrency,
    });

    if (!problem.fee_paid && !['published', 'public', 'open', 'awarded', 'closed'].includes(problem.status)) {
      await client.query(
        `UPDATE problems
         SET fee_paid = true,
             status = 'published',
             stripe_session_id = COALESCE($2, stripe_session_id),
             updated_at = now()
         WHERE id = $1`,
        [problemId, sessionId]
      );

      webhookLog('challenge_published', {
        eventId,
        problemId,
        title: problem.title,
      });
    } else {
      webhookLog('already_published', {
        eventId,
        problemId,
        status: problem.status,
        feePaid: problem.fee_paid,
      });
    }

    await client.query(
      `UPDATE stripe_webhook_events
       SET status = 'processed',
           session_id = COALESCE($2, session_id),
           payment_intent_id = COALESCE($3, payment_intent_id),
           customer_email = COALESCE($4, customer_email),
           processed_at = now()
       WHERE event_id = $1`,
      [eventId, sessionId, paymentIntentId, customerEmail]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await upsertWebhookEventStatus(eventId, {
      eventType: event.type,
      sessionId,
      paymentIntentId,
      customerEmail,
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  } finally {
    client.release();
  }
}

async function stripeWebhookHandler(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook not configured');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    webhookWarn('signature_validation_failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await processCheckoutSessionCompleted(event);
    } else {
      webhookLog('event_ignored', { eventId: event.id, eventType: event.type });
    }

    // Keep a fast ACK so Stripe does not retry successful deliveries.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook processing error:', err.message);
    res.status(500).send('Webhook processing failed');
  }
}

module.exports = {
  paymentsRouter: router,
  stripeWebhookHandler,
  calculatePublishFee,
};
