const pool = require('../db');

async function listPublished() {
  const result = await pool.query(
    "SELECT id, title, description, status FROM courses WHERE status = 'published' ORDER BY id"
  );
  return result.rows;
}

async function listByInstructor(instructorId) {
  const result = await pool.query(
    'SELECT id, title, description, status FROM courses WHERE instructor_id = $1 ORDER BY id',
    [instructorId]
  );
  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT id, title, description, status, instructor_id FROM courses WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function listModules(courseId) {
  const result = await pool.query(
    'SELECT id, title, position, due_date FROM modules WHERE course_id = $1 ORDER BY position',
    [courseId]
  );
  return result.rows;
}

async function countModules(courseId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS n FROM modules WHERE course_id = $1',
    [courseId]
  );
  return result.rows[0].n;
}

async function create({ title, description, instructorId }) {
  const result = await pool.query(
    'INSERT INTO courses (title, description, instructor_id) VALUES ($1, $2, $3) RETURNING id, title, description, status, instructor_id',
    [title, description, instructorId]
  );
  return result.rows[0];
}

async function update(id, { title, description }) {
  const result = await pool.query(
    'UPDATE courses SET title = $1, description = $2 WHERE id = $3 RETURNING id, title, description, status',
    [title, description, id]
  );
  return result.rows[0];
}

async function updateStatus(id, status) {
  const result = await pool.query(
    'UPDATE courses SET status = $1 WHERE id = $2 RETURNING id, title, status',
    [status, id]
  );
  return result.rows[0];
}

module.exports = {
  listPublished,
  listByInstructor,
  findById,
  listModules,
  countModules,
  create,
  update,
  updateStatus,
};