const pool = require('../db');

async function findById(id) {
  const result = await pool.query(
    'SELECT id, student_id, course_id, status FROM enrollments WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function findByStudentAndCourse(studentId, courseId) {
  const result = await pool.query(
    'SELECT id, status FROM enrollments WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );
  return result.rows[0] || null;
}

async function create(studentId, courseId) {
  const result = await pool.query(
    'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING id, course_id, status, enrolled_at',
    [studentId, courseId]
  );
  return result.rows[0];
}

async function reactivate(id) {
  const result = await pool.query(
    "UPDATE enrollments SET status = 'active', enrolled_at = now() WHERE id = $1 RETURNING id, course_id, status, enrolled_at",
    [id]
  );
  return result.rows[0];
}

async function setStatus(id, status) {
  const result = await pool.query(
    'UPDATE enrollments SET status = $1 WHERE id = $2 RETURNING id, course_id, status',
    [status, id]
  );
  return result.rows[0];
}

async function listForStudent(studentId) {
  const result = await pool.query(
    `SELECT e.id AS enrollment_id, e.status, e.enrolled_at,
            c.id AS course_id, c.title,
            (SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id) AS total_modules,
            (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id) AS completed_modules
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.status <> 'dropped'
     ORDER BY e.id`,
    [studentId]
  );
  return result.rows;
}

async function moduleBelongsToCourse(moduleId, courseId) {
  const result = await pool.query(
    'SELECT id FROM modules WHERE id = $1 AND course_id = $2',
    [moduleId, courseId]
  );
  return result.rows.length > 0;
}

async function addCompletion(enrollmentId, moduleId) {
  await pool.query(
    'INSERT INTO module_completions (enrollment_id, module_id) VALUES ($1, $2)',
    [enrollmentId, moduleId]
  );
}

async function removeCompletion(enrollmentId, moduleId) {
  const result = await pool.query(
    'DELETE FROM module_completions WHERE enrollment_id = $1 AND module_id = $2 RETURNING module_id',
    [enrollmentId, moduleId]
  );
  return result.rows.length > 0;
}

async function getProgress(enrollmentId, courseId) {
  const result = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM modules WHERE course_id = $2) AS total,
            (SELECT COUNT(*)::int FROM module_completions WHERE enrollment_id = $1) AS done`,
    [enrollmentId, courseId]
  );
  return result.rows[0];
}

async function courseCounts(courseId) {
  const result = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status <> 'dropped')::int AS enrolled,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'dropped')::int AS dropped
     FROM enrollments WHERE course_id = $1`,
    [courseId]
  );
  return result.rows[0];
}

async function activeProgress(courseId) {
  const result = await pool.query(
    `SELECT COUNT(mc.module_id)::int AS done
     FROM enrollments e
     LEFT JOIN module_completions mc ON mc.enrollment_id = e.id
     WHERE e.course_id = $1 AND e.status <> 'dropped'
     GROUP BY e.id`,
    [courseId]
  );
  return result.rows;
}

module.exports = {
  findById,
  findByStudentAndCourse,
  create,
  reactivate,
  setStatus,
  listForStudent,
  moduleBelongsToCourse,
  addCompletion,
  removeCompletion,
  getProgress,
  courseCounts,
  activeProgress,
};