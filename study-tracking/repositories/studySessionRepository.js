const pool = require('../db');

async function findActiveEnrollment(userId, courseId) {
  const result = await pool.query(
    "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'active'",
    [userId, courseId]
  );
  return result.rows[0] || null;
}

async function create(userId, courseId, minutes) {
  const result = await pool.query(
    `INSERT INTO study_sessions (user_id, course_id, minutes)
     VALUES ($1, $2, $3)
     RETURNING id, course_id, minutes, studied_at`,
    [userId, courseId, minutes]
  );
  return result.rows[0];
}

async function listForUser(userId, courseId) {
  if (courseId) {
    const result = await pool.query(
      `SELECT id, course_id, minutes, studied_at
       FROM study_sessions
       WHERE user_id = $1 AND course_id = $2
       ORDER BY studied_at DESC`,
      [userId, courseId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT id, course_id, minutes, studied_at
     FROM study_sessions
     WHERE user_id = $1
     ORDER BY studied_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = { findActiveEnrollment, create, listForUser };