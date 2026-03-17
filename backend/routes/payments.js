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

async function publishProblemFromPaymentIntent(paymentIntent) {
  const problemId = paymentIntent?.metadata?.problemId;
  if (!problemId) return;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      `SELECT p.id, p.status, p.fee_paid, r.amount
       FROM problems p
       JOIN rewards r ON p.reward_id = r.id
       WHERE p.id = $1
       FOR UPDATE`,
      [problemId]
    );

    if (r.rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const problem = r.rows[0];
    if (problem.fee_paid || problem.status === 'published') {
      await client.query('COMMIT');
      return;
    }

    const expectedFeeCents = toCents(calculatePublishFee(Number(problem.amount)));
    const paidCents = Number(paymentIntent.amount_received || paymentIntent.amount || 0);

    if (paidCents < expectedFeeCents) {
      console.error('Stripe payment amount mismatch for problem:', problemId);
      await client.query('ROLLBACK');
      return;
    }

    await client.query(
      `UPDATE problems
       SET status = 'published',
           fee_paid = true,
           updated_at = now()
       WHERE id = $1`,
      [problemId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await publishProblemFromPaymentIntent(event.data.object);
    }
    res.json({ received: true });
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
