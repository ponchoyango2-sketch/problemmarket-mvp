const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const aiRoutes = require('./routes/ai');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-in-production';
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed'));
    },
  })
);
app.use(bodyParser.json());

app.use('/api/ai', aiRoutes);

function calculateCommission(amount) {
  return Math.round(amount * 0.10 * 100) / 100; // 10%
}

app.get('/', (req, res) => {
  res.json({ name: 'ProblemMarket MVP', status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Register
app.post('/users/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const q = 'INSERT INTO users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email, reputation, created_at';
    const r = await db.query(q, [name, email, passwordHash]);
    const user = r.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Login
app.post('/users/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const q = 'SELECT id, name, email, password_hash, reputation FROM users WHERE email = $1';
    const r = await db.query(q, [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create a user (simple)
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const q = 'INSERT INTO users(name, email) VALUES($1, $2) RETURNING *';
    const r = await db.query(q, [name, email]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// List problems with reward
app.get('/problems', async (req, res) => {
  try {
    const q = `SELECT p.*, r.amount AS reward_amount, r.currency, r.escrow_status
               FROM problems p
               LEFT JOIN rewards r ON p.reward_id = r.id
               ORDER BY p.created_at DESC`;
    const r = await db.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create problem with reward (transaction)
app.post('/problems', verifyToken, async (req, res) => {
  const { title, description, reward } = req.body;
  if (!title || !reward) return res.status(400).json({ error: 'title and reward required' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const insertReward = 'INSERT INTO rewards(amount, currency) VALUES($1, $2) RETURNING id, amount, currency';
    const r1 = await client.query(insertReward, [reward.amount || reward, reward.currency || 'USD']);
    const rewardId = r1.rows[0].id;
    const insertProblem = 'INSERT INTO problems(publisher_id, title, description, reward_id) VALUES($1, $2, $3, $4) RETURNING *';
    const r2 = await client.query(insertProblem, [req.user.userId, title, description || '', rewardId]);
    await client.query('COMMIT');
    res.status(201).json({ problem: r2.rows[0], reward: r1.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'db error' });
  } finally {
    client.release();
  }
});

// Get problem by id with solutions
app.get('/problems/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const pq = 'SELECT p.*, r.amount AS reward_amount, r.currency, r.escrow_status FROM problems p LEFT JOIN rewards r ON p.reward_id = r.id WHERE p.id = $1';
    const pr = await db.query(pq, [id]);
    if (pr.rowCount === 0) return res.status(404).json({ error: 'not found' });
    const sq = 'SELECT s.* FROM solutions s WHERE s.problem_id = $1 ORDER BY s.created_at ASC';
    const sr = await db.query(sq, [id]);
    const problem = pr.rows[0];
    problem.solutions = sr.rows;
    res.json(problem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Submit solution
app.post('/problems/:id/solutions', verifyToken, async (req, res) => {
  const problemId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  try {
    // ensure problem is open
    const pr = await db.query('SELECT status FROM problems WHERE id = $1', [problemId]);
    if (pr.rowCount === 0) return res.status(404).json({ error: 'problem not found' });
    if (pr.rows[0].status !== 'open') return res.status(400).json({ error: 'problem not open' });
    const iq = 'INSERT INTO solutions(problem_id, author_id, content) VALUES($1, $2, $3) RETURNING *';
    const r = await db.query(iq, [problemId, req.user.userId, content]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Select winner and release reward
app.post('/problems/:id/select-winner', verifyToken, async (req, res) => {
  const problemId = req.params.id;
  const { solutionId } = req.body;
  if (!solutionId) return res.status(400).json({ error: 'solutionId required' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const pq = 'SELECT p.id, p.publisher_id, p.reward_id, r.amount FROM problems p JOIN rewards r ON p.reward_id = r.id WHERE p.id = $1 FOR UPDATE';
    const pr = await client.query(pq, [problemId]);
    if (pr.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'problem not found' }); }
    const reward = pr.rows[0];
    if (reward.publisher_id !== req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the problem owner can select winner' });
    }
    const sq = 'SELECT * FROM solutions WHERE id = $1 AND problem_id = $2';
    const sr = await client.query(sq, [solutionId, problemId]);
    if (sr.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'solution not found' }); }
    // compute commission
    const commission = calculateCommission(Number(reward.amount));
    const payout = Math.round((Number(reward.amount) - commission) * 100) / 100;
    // ensure single winner
    await client.query('UPDATE solutions SET selected = false WHERE problem_id = $1', [problemId]);
    // mark solution selected
    await client.query('UPDATE solutions SET selected = true WHERE id = $1', [solutionId]);
    // update problem status
    await client.query('UPDATE problems SET status = $1 WHERE id = $2', ['awarded', problemId]);
    // update reward
    await client.query('UPDATE rewards SET escrow_status=$1, platform_fee=$2, released_at=now() WHERE id=$3', ['released', commission, reward.reward_id]);
    await client.query('COMMIT');
    res.json({ success: true, payout, commission });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'db error' });
  } finally {
    client.release();
  }
});

// Platform fees sum
app.get('/platform/fees', async (req, res) => {
  try {
    const r = await db.query('SELECT COALESCE(SUM(platform_fee),0) AS total FROM rewards');
    res.json({ platformFees: Number(r.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`ProblemMarket MVP backend running on http://localhost:${port}`));
