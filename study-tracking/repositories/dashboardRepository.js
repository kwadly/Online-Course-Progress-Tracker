const pool = require('../db');

async function courseProgress(userId) {
  const result = await pool.query(
    `SELECT c.id AS course_id, c.title,
            (SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id) AS total_modules,
            (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id) AS completed_modules
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.status = 'active'
     ORDER BY c.id`,
    [userId]
  );
  return result.rows;
}

async function upcomingDeadlines(userId, days) {
  const result = await pool.query(
    `SELECT m.id AS module_id, m.title AS module_title,
            to_char(m.due_date, 'YYYY-MM-DD') AS due_date,
            (m.due_date < CURRENT_DATE) AS overdue,
            c.id AS course_id, c.title AS course_title
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN modules m ON m.course_id = c.id
     WHERE e.student_id = $1 AND e.status = 'active'
       AND m.due_date IS NOT NULL
       AND m.due_date <= CURRENT_DATE + $2::int
       AND NOT EXISTS (
         SELECT 1 FROM module_completions mc
         WHERE mc.enrollment_id = e.id AND mc.module_id = m.id)
     ORDER BY m.due_date, m.id`,
    [userId, days]
  );
  return result.rows;
}

async function minutesThisWeek(userId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(minutes), 0)::int AS minutes
     FROM study_sessions
     WHERE user_id = $1 AND studied_at >= date_trunc('week', now())`,
    [userId]
  );
  return result.rows[0].minutes;
}

async function weeklyGoalHours(userId) {
  const result = await pool.query(
    'SELECT hours_per_week FROM weekly_goals WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] ? Number(result.rows[0].hours_per_week) : null;
}

module.exports = { courseProgress, upcomingDeadlines, minutesThisWeek, weeklyGoalHours };