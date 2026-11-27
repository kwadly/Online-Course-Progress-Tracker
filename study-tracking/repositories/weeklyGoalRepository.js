const pool = require('../db');

async function upsert(userId, hoursPerWeek) {
  const result = await pool.query(
    `INSERT INTO weekly_goals (user_id, hours_per_week)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET hours_per_week = EXCLUDED.hours_per_week, updated_at = now()
     RETURNING hours_per_week, updated_at`,
    [userId, hoursPerWeek]
  );
  return result.rows[0];
}

async function findByUser(userId) {
  const result = await pool.query(
    'SELECT hours_per_week, updated_at FROM weekly_goals WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

async function minutesThisWeekByCourse(userId) {
  const result = await pool.query(
    `SELECT course_id, SUM(minutes)::int AS minutes
     FROM study_sessions
     WHERE user_id = $1 AND studied_at >= date_trunc('week', now())
     GROUP BY course_id
     ORDER BY course_id`,
    [userId]
  );
  return result.rows;
}

module.exports = { upsert, findByUser, minutesThisWeekByCourse };