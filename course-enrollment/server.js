const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');
const courseRoutes = require('./routes/courses');
const moduleRoutes = require('./routes/modules');
const enrollmentRoutes = require('./routes/enrollments');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');

if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY) {
  console.error('JWT_SECRET and INTERNAL_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use('/api/courses', courseRoutes);
app.use('/api', moduleRoutes);
app.use('/api', enrollmentRoutes);

// ---------- helpers used by many doors ----------
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serverError(res, err) {
  console.error(err.message);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if ([name, email, password, role].some((v) => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ error: 'email is not valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (!['student', 'instructor'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or instructor' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name.trim(), email.trim().toLowerCase(), passwordHash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if ([email, password].some((v) => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));

    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});


// ---------- internal (service to service) ----------
function requireInternalKey(req, res, next) {
  const given = Buffer.from(String(req.headers['x-api-key'] || ''));
  const expected = Buffer.from(process.env.INTERNAL_API_KEY);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Missing or invalid internal key' });
  }
  next();
}

app.get('/api/internal/overview', requireInternalKey, async (req, res) => {
  const days = req.query.days === undefined ? 14 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ error: 'days must be a whole number from 1 to 365' });
  }
  try {
    const enrollments = await pool.query(
      `SELECT e.id AS enrollment_id, e.student_id, c.id AS course_id, c.title AS course_title,
              (SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id) AS total_modules,
              (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id) AS completed_modules
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.status = 'active'
       ORDER BY e.student_id, e.id`
    );
    const due = await pool.query(
      `SELECT e.id AS enrollment_id, m.id AS module_id, m.title, m.due_date,
              (m.due_date < CURRENT_DATE) AS overdue
       FROM enrollments e
       JOIN modules m ON m.course_id = e.course_id
       WHERE e.status = 'active'
         AND m.due_date IS NOT NULL
         AND m.due_date <= CURRENT_DATE + $1::int
         AND NOT EXISTS (
           SELECT 1 FROM module_completions mc
           WHERE mc.enrollment_id = e.id AND mc.module_id = m.id
         )
       ORDER BY m.due_date, m.id`,
      [days]
    );
    const dueByEnrollment = new Map();
    for (const m of due.rows) {
      if (!dueByEnrollment.has(m.enrollment_id)) dueByEnrollment.set(m.enrollment_id, []);
      dueByEnrollment.get(m.enrollment_id).push({
        module_id: m.module_id,
        title: m.title,
        due_date: m.due_date,
        overdue: m.overdue,
      });
    }
    const rows = enrollments.rows.map((e) => ({
      ...e,
      remaining_modules: e.total_modules - e.completed_modules,
      percent: e.total_modules ? Math.round((e.completed_modules * 100) / e.total_modules) : 0,
      due_modules: dueByEnrollment.get(e.enrollment_id) || [],
    }));
    res.status(200).json(rows);
  } catch (err) {
    serverError(res, err);
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});