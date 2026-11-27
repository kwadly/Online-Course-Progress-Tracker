const pool = require('../db');

async function insert(event) {
  await pool.query(
    'INSERT INTO activity_events (event_type, student_id, course_id, module_id, percent) VALUES ($1, $2, $3, $4, $5)',
    [event.type, event.student_id, event.course_id, event.module_id || null, event.percent === undefined ? null : event.percent]
  );
}

async function listForCourse(courseId, limit) {
  const result = await pool.query(
    `SELECT a.id, a.event_type, a.student_id, u.name AS student_name,
            a.module_id, a.percent, a.occurred_at
     FROM activity_events a
     JOIN users u ON u.id = a.student_id
     WHERE a.course_id = $1
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT $2`,
    [courseId, limit]
  );
  return result.rows;
}

module.exports = { insert, listForCourse };