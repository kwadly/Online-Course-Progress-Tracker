const pool = require('../db');

async function insertIfNew(userId, moduleId, type, riskLevel) {
  const result = await pool.query(
    `INSERT INTO reminders (user_id, module_id, type, risk_level, remind_at)
     SELECT $1::int, $2::int, $3::text, $4::text, now()
     WHERE NOT EXISTS (
       SELECT 1 FROM reminders
       WHERE user_id = $1::int AND module_id = $2::int AND type = $3::text
         AND created_at::date = CURRENT_DATE)
     RETURNING id`,
    [userId, moduleId, type, riskLevel]
  );
  return result.rows[0] || null;
}

async function listForUser(userId, type) {
  const result = await pool.query(
    `SELECT r.id, r.type, r.risk_level, r.status, r.remind_at,
            m.id AS module_id, m.title AS module_title,
            to_char(m.due_date, 'YYYY-MM-DD') AS due_date,
            c.id AS course_id, c.title AS course_title
     FROM reminders r
     JOIN modules m ON m.id = r.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE r.user_id = $1 AND ($2::text IS NULL OR r.type = $2::text)
     ORDER BY r.remind_at DESC, r.id DESC`,
    [userId, type]
  );
  return result.rows;
}

async function listPending() {
  const result = await pool.query(
    `SELECT r.id, r.type, r.risk_level, u.name AS student_name,
            m.title AS module_title, to_char(m.due_date, 'YYYY-MM-DD') AS due_date,
            c.title AS course_title
     FROM reminders r
     JOIN users u ON u.id = r.user_id
     JOIN modules m ON m.id = r.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE r.status = 'pending'
     ORDER BY r.id`
  );
  return result.rows;
}

async function markSent(id) {
  await pool.query("UPDATE reminders SET status = 'sent' WHERE id = $1", [id]);
}

async function minutesLast7Days(userId) {
  const result = await pool.query(
    `SELECT course_id, SUM(minutes)::int AS minutes
     FROM study_sessions
     WHERE user_id = $1 AND studied_at >= now() - interval '7 days'
     GROUP BY course_id`,
    [userId]
  );
  return result.rows;
}

module.exports = { insertIfNew, listForUser, listPending, markSent, minutesLast7Days };