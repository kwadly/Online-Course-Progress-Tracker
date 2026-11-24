const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');
const courseRoutes = require('./routes/courses');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');

if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY) {
  console.error('JWT_SECRET and INTERNAL_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use('/api/courses', courseRoutes);

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

// ---------- enrollments ----------
async function getProgress(enrollmentId, courseId) {
  const r = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM modules WHERE course_id = $2) AS total,
            (SELECT COUNT(*)::int FROM module_completions WHERE enrollment_id = $1) AS done`,
    [enrollmentId, courseId]
  );
  const { total, done } = r.rows[0];
  return {
    total_modules: total,
    completed_modules: done,
    percent: total ? Math.round((done * 100) / total) : 0,
  };
}


async function getOwnEnrollment(req, res, enrollmentId) {
  const found = await pool.query(
    'SELECT id, student_id, course_id, status FROM enrollments WHERE id = $1',
    [enrollmentId]
  );
  const enrollment = found.rows[0];
  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found' });
    return null;
  }
  if (enrollment.student_id !== req.user.id) {
    res.status(403).json({ error: 'This is not your enrollment' });
    return null;
  }
  return enrollment;
}

app.post('/api/courses/:id/enroll', requireAuth, requireRole('student'), async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    const course = await pool.query(
      "SELECT id FROM courses WHERE id = $1 AND status = 'published'",
      [courseId]
    );
    if (!course.rows[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const existing = await pool.query(
      'SELECT id, status FROM enrollments WHERE student_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status !== 'dropped') {
        return res.status(409).json({ error: 'You are already enrolled in this course' });
      }
      // Re-enrolling after a drop brings the old enrollment back
      const again = await pool.query(
        "UPDATE enrollments SET status = 'active', enrolled_at = now() WHERE id = $1 RETURNING id, course_id, status, enrolled_at",
        [existing.rows[0].id]
      );
      return res.status(200).json(again.rows[0]);
    }
    const created = await pool.query(
      'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING id, course_id, status, enrolled_at',
      [req.user.id, courseId]
    );
    res.status(201).json(created.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You are already enrolled in this course' });
    }
    serverError(res, err);
  }
});

app.patch('/api/enrollments/:id/drop', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'enrollment id must be a positive whole number' });
  }
  try {
    const enrollment = await getOwnEnrollment(req, res, id);
    if (!enrollment) return;
    if (enrollment.status !== 'active') {
      return res.status(409).json({ error: 'Only an active enrollment can be dropped' });
    }
    const result = await pool.query(
      "UPDATE enrollments SET status = 'dropped' WHERE id = $1 RETURNING id, course_id, status",
      [id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    serverError(res, err);
  }
});

app.get('/api/enrollments/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id AS enrollment_id, e.status, e.enrolled_at,
              c.id AS course_id, c.title,
              (SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id) AS total_modules,
              (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id) AS completed_modules
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1 AND e.status <> 'dropped'
       ORDER BY e.id`,
      [req.user.id]
    );
    const rows = result.rows.map((r) => ({
      ...r,
      percent: r.total_modules ? Math.round((r.completed_modules * 100) / r.total_modules) : 0,
    }));
    res.status(200).json(rows);
  } catch (err) {
    serverError(res, err);
  }
});

app.post('/api/enrollments/:id/modules/:moduleId/complete', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  const moduleId = parseId(req.params.moduleId);
  if (!id || !moduleId) {
    return res.status(400).json({ error: 'ids must be positive whole numbers' });
  }
  try {
    const enrollment = await getOwnEnrollment(req, res, id);
    if (!enrollment) return;
    if (enrollment.status !== 'active') {
      return res.status(409).json({ error: 'Only an active enrollment can be changed' });
    }
    const mod = await pool.query(
      'SELECT id FROM modules WHERE id = $1 AND course_id = $2',
      [moduleId, enrollment.course_id]
    );
    if (!mod.rows[0]) {
      return res.status(404).json({ error: 'Module not found in this course' });
    }
    await pool.query(
      'INSERT INTO module_completions (enrollment_id, module_id) VALUES ($1, $2)',
      [id, moduleId]
    );
    const progress = await getProgress(id, enrollment.course_id);
    let status = 'active';
    if (progress.total_modules > 0 && progress.completed_modules === progress.total_modules) {
      await pool.query("UPDATE enrollments SET status = 'completed' WHERE id = $1", [id]);
      status = 'completed';
    }
    res.status(201).json({ enrollment_id: id, module_id: moduleId, enrollment_status: status, ...progress });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This module is already marked as done' });
    }
    serverError(res, err);
  }
});

app.delete('/api/enrollments/:id/modules/:moduleId/complete', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  const moduleId = parseId(req.params.moduleId);
  if (!id || !moduleId) {
    return res.status(400).json({ error: 'ids must be positive whole numbers' });
  }
  try {
    const enrollment = await getOwnEnrollment(req, res, id);
    if (!enrollment) return;
    if (enrollment.status === 'dropped') {
      return res.status(409).json({ error: 'A dropped enrollment cannot be changed' });
    }
    const removed = await pool.query(
      'DELETE FROM module_completions WHERE enrollment_id = $1 AND module_id = $2 RETURNING module_id',
      [id, moduleId]
    );
    if (!removed.rows[0]) {
      return res.status(404).json({ error: 'This module was not marked as done' });
    }
    let status = enrollment.status;
    // Undoing a module reopens a completed enrollment
    if (status === 'completed') {
      await pool.query("UPDATE enrollments SET status = 'active' WHERE id = $1", [id]);
      status = 'active';
    }
    const progress = await getProgress(id, enrollment.course_id);
    res.status(200).json({ enrollment_id: id, module_id: moduleId, enrollment_status: status, ...progress });
  } catch (err) {
    serverError(res, err);
  }
});

app.get('/api/courses/:id/stats', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    const course = await pool.query('SELECT id, title, instructor_id FROM courses WHERE id = $1', [id]);
    if (!course.rows[0]) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.rows[0].instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only see stats for your own courses' });
    }
    const total = await pool.query('SELECT COUNT(*)::int AS n FROM modules WHERE course_id = $1', [id]);
    const counts = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status <> 'dropped')::int AS enrolled,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'dropped')::int AS dropped
       FROM enrollments WHERE course_id = $1`,
      [id]
    );
    const progress = await pool.query(
      `SELECT COUNT(mc.module_id)::int AS done
       FROM enrollments e
       LEFT JOIN module_completions mc ON mc.enrollment_id = e.id
       WHERE e.course_id = $1 AND e.status <> 'dropped'
       GROUP BY e.id`,
      [id]
    );
    const totalModules = total.rows[0].n;
    let average = 0;
    if (totalModules > 0 && progress.rows.length > 0) {
      const sum = progress.rows.reduce((acc, r) => acc + (r.done * 100) / totalModules, 0);
      average = Math.round(sum / progress.rows.length);
    }
    res.status(200).json({
      course_id: id,
      title: course.rows[0].title,
      total_modules: totalModules,
      ...counts.rows[0],
      average_progress_percent: average,
    });
  } catch (err) {
    serverError(res, err);
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