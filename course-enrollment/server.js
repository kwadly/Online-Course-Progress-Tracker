const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing from .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

// ---------- helpers used by many doors ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Only ' + role + 's can do this' });
    }
    next();
  };
}

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

app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, status FROM courses WHERE status = 'published' ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
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

// ---------- courses ----------
app.post('/api/courses', requireAuth, requireRole('instructor'), async (req, res) => {
  const { title, description } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be text' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO courses (title, description, instructor_id) VALUES ($1, $2, $3) RETURNING id, title, description, status, instructor_id',
      [title.trim(), description ? description.trim() : null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    serverError(res, err);
  }
});

app.get('/api/courses/mine', requireAuth, requireRole('instructor'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, status FROM courses WHERE instructor_id = $1 ORDER BY id',
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    serverError(res, err);
  }
});

app.get('/api/courses/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    const found = await pool.query(
      'SELECT id, title, description, status, instructor_id FROM courses WHERE id = $1',
      [id]
    );
    const course = found.rows[0];
    // Unpublished courses are visible only to their own instructor
    if (!course || (course.status !== 'published' && course.instructor_id !== req.user.id)) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const modules = await pool.query(
      'SELECT id, title, position, due_date FROM modules WHERE course_id = $1 ORDER BY position',
      [id]
    );
    res.status(200).json({ ...course, modules: modules.rows });
  } catch (err) {
    serverError(res, err);
  }
});

app.put('/api/courses/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  const { title, description } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be text' });
  }
  try {
    const found = await pool.query('SELECT instructor_id FROM courses WHERE id = $1', [id]);
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (found.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own courses' });
    }
    const result = await pool.query(
      'UPDATE courses SET title = $1, description = $2 WHERE id = $3 RETURNING id, title, description, status',
      [title.trim(), description ? description.trim() : null, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    serverError(res, err);
  }
});

app.patch('/api/courses/:id/status', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  const { status } = req.body || {};
  if (!['published', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'status must be published or archived' });
  }
  try {
    const found = await pool.query('SELECT instructor_id FROM courses WHERE id = $1', [id]);
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (found.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only change your own courses' });
    }
    if (status === 'published') {
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM modules WHERE course_id = $1', [id]);
      if (count.rows[0].n === 0) {
        return res.status(409).json({ error: 'A course needs at least one module before it can be published' });
      }
    }
    const result = await pool.query(
      'UPDATE courses SET status = $1 WHERE id = $2 RETURNING id, title, status',
      [status, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    serverError(res, err);
  }
});

// ---------- modules ----------
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function checkModuleBody(body) {
  const { title, position, due_date } = body || {};
  if (typeof title !== 'string' || !title.trim()) return 'title is required';
  if (!Number.isInteger(position) || position < 1) return 'position must be a whole number, 1 or more';
  if (due_date !== undefined && due_date !== null && !isValidDate(due_date)) {
    return 'due_date must be a real date written as YYYY-MM-DD';
  }
  return null;
}

app.post('/api/courses/:id/modules', requireAuth, requireRole('instructor'), async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  const problem = checkModuleBody(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  const { title, position, due_date } = req.body;
  try {
    const found = await pool.query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (found.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only add modules to your own courses' });
    }
    const result = await pool.query(
      'INSERT INTO modules (course_id, title, position, due_date) VALUES ($1, $2, $3, $4) RETURNING id, course_id, title, position, due_date',
      [courseId, title.trim(), position, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That position is already used in this course' });
    }
    serverError(res, err);
  }
});

app.put('/api/modules/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'module id must be a positive whole number' });
  }
  const problem = checkModuleBody(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  const { title, position, due_date } = req.body;
  try {
    const found = await pool.query(
      'SELECT c.instructor_id FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = $1',
      [id]
    );
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Module not found' });
    }
    if (found.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit modules of your own courses' });
    }
    const result = await pool.query(
      'UPDATE modules SET title = $1, position = $2, due_date = $3 WHERE id = $4 RETURNING id, course_id, title, position, due_date',
      [title.trim(), position, due_date || null, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That position is already used in this course' });
    }
    serverError(res, err);
  }
});

app.delete('/api/modules/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'module id must be a positive whole number' });
  }
  try {
    const found = await pool.query(
      'SELECT c.instructor_id FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = $1',
      [id]
    );
    if (!found.rows[0]) {
      return res.status(404).json({ error: 'Module not found' });
    }
    if (found.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete modules of your own courses' });
    }
    const done = await pool.query('SELECT COUNT(*)::int AS n FROM module_completions WHERE module_id = $1', [id]);
    if (done.rows[0].n > 0) {
      return res.status(409).json({ error: 'Students have already completed this module, so it cannot be deleted' });
    }
    await pool.query('DELETE FROM modules WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    serverError(res, err);
  }
});

app.get('/api/modules/upcoming', requireAuth, requireRole('student'), async (req, res) => {
  const days = req.query.days === undefined ? 14 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ error: 'days must be a whole number from 1 to 365' });
  }
  try {
    const result = await pool.query(
      `SELECT m.id AS module_id, m.title, m.due_date, c.id AS course_id, c.title AS course_title
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN modules m ON m.course_id = c.id
       WHERE e.student_id = $1
         AND e.status = 'active'
         AND m.due_date IS NOT NULL
         AND m.due_date >= CURRENT_DATE
         AND m.due_date <= CURRENT_DATE + $2::int
         AND NOT EXISTS (
           SELECT 1 FROM module_completions mc
           WHERE mc.enrollment_id = e.id AND mc.module_id = m.id
         )
       ORDER BY m.due_date, m.id`,
      [req.user.id, days]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    serverError(res, err);
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});