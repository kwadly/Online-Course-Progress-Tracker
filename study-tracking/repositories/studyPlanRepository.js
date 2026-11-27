const pool = require('../db');

async function goalHours(userId) {
  const result = await pool.query(
    'SELECT hours_per_week FROM weekly_goals WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] ? Number(result.rows[0].hours_per_week) : null;
}

async function weekStart() {
  const result = await pool.query(
    "SELECT to_char(date_trunc('week', now()), 'YYYY-MM-DD') AS week_start"
  );
  return result.rows[0].week_start;
}

async function courseLoad(userId) {
  const result = await pool.query(
    `SELECT c.id AS course_id, c.title,
            ((SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id)
             - (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id)) AS remaining_modules,
            (SELECT MIN(m.due_date) - CURRENT_DATE
             FROM modules m
             WHERE m.course_id = c.id AND m.due_date IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM module_completions mc
                               WHERE mc.enrollment_id = e.id AND mc.module_id = m.id)) AS days_to_deadline
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.status = 'active'
     ORDER BY c.id`,
    [userId]
  );
  return result.rows;
}

async function replacePlan(userId, week, rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM study_plans WHERE user_id = $1 AND week_start = $2', [userId, week]);
    for (const r of rows) {
      await client.query(
        'INSERT INTO study_plans (user_id, course_id, week_start, planned_minutes) VALUES ($1, $2, $3, $4)',
        [userId, r.course_id, week, r.planned_minutes]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function currentPlan(userId) {
  const result = await pool.query(
    `SELECT sp.course_id, c.title, sp.planned_minutes,
            to_char(sp.week_start, 'YYYY-MM-DD') AS week_start
     FROM study_plans sp
     JOIN courses c ON c.id = sp.course_id
     WHERE sp.user_id = $1 AND sp.week_start = date_trunc('week', now())::date
     ORDER BY sp.planned_minutes DESC, sp.course_id`,
    [userId]
  );
  return result.rows;
}

module.exports = { goalHours, weekStart, courseLoad, replacePlan, currentPlan };