const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';

const SYSTEM_PROMPT = `You are ProblemMarket's AI Advisor — a hybrid senior software engineer, serial entrepreneur, and business strategist operating in 2026.

Your purpose:
1. Solve technical and business problems with precision and speed
2. Identify monetization opportunities hidden inside any idea or problem
3. Propose actionable systems, architectures, and go-to-market strategies
4. Be direct, structured, and immediately useful — never vague

Response rules:
- Use markdown-style formatting: headers (##), bullet points, **bold** for key terms
- Always end with concrete next steps
- If the question has business potential → include a section "💡 Oportunidad de Negocio" with: idea, cómo construirla, cómo monetizarla
- If it can be automated → include "⚙️ Cómo Automatizarlo" with stack, architecture, steps
- If it needs technical implementation → include "🛠️ Implementación" with code approach
- Respond in the same language the user writes in (Spanish or English)
- Be conversational but authoritative — like a brilliant co-founder who has shipped products

Forbidden: generic advice, "it depends" without specifics, long theory without actionable outcome.`;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Optional auth — attaches req.user if token is valid, doesn't block otherwise
function optionalAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    } catch (_) {
      // ignore invalid token — treat as anonymous
    }
  }
  next();
}

// Lazy-init OpenAI client
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// POST /api/ai/chat
router.post('/chat', optionalAuth, async (req, res) => {
  const { message, history, sessionId, problemContext } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'message too long (max 4000 chars)' });
  }

  try {
    const openai = getOpenAI();

    // Build conversation messages
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Inject problem context when viewing a specific problem
    if (problemContext && typeof problemContext.title === 'string') {
      messages.push({
        role: 'system',
        content: `The user is currently viewing this problem on ProblemMarket:\n` +
          `Title: ${String(problemContext.title).slice(0, 200)}\n` +
          `Description: ${String(problemContext.description || '').slice(0, 500)}\n` +
          `Reward: $${Number(problemContext.reward) || 0}`,
      });
    }

    // Add sanitized history (max last 10 turns = 20 messages)
    if (Array.isArray(history)) {
      for (const msg of history.slice(-20)) {
        if (
          msg &&
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string'
        ) {
          messages.push({ role: msg.role, content: msg.content.slice(0, 2000) });
        }
      }
    }

    messages.push({ role: 'user', content: message.trim() });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'No response generated.';

    // Persist history for authenticated users with a valid sessionId
    if (req.user && sessionId && UUID_REGEX.test(sessionId)) {
      try {
        await db.query(
          'INSERT INTO chat_history(user_id, role, content, session_id) VALUES($1,$2,$3,$4)',
          [req.user.userId, 'user', message.trim(), sessionId]
        );
        await db.query(
          'INSERT INTO chat_history(user_id, role, content, session_id) VALUES($1,$2,$3,$4)',
          [req.user.userId, 'assistant', reply, sessionId]
        );
      } catch (dbErr) {
        // Don't fail the response over a history save error
        console.error('chat_history save error:', dbErr.message);
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('AI route error:', err.message);
    if (err.message.includes('OPENAI_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured. Contact administrator.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'AI rate limit reached. Try again in a moment.' });
    }
    res.status(500).json({ error: 'AI service error' });
  }
});

// GET /api/ai/history — authenticated users only
router.get('/history', (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT session_id, role, content, created_at
       FROM chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.userId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
