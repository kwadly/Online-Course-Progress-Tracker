const pool = require('../db');

async function listActiveEnrollments() {
  const result = await pool.query(
    `SELECT e.id AS enrollment_id, e.student_id, c.id AS course_id, c.title AS course_title,
            (SELECT COUNT(*)::int FROM modules m WHERE m.course_id = c.id) AS total_modules,
            (SELECT COUNT(*)::int FROM module_completions mc WHERE mc.enrollment_id = e.id) AS completed_modules
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.status = 'active'
     ORDER BY e.student_id, e.id`
  );
  return result.rows;
}

async function listDueModules(days) {
  const result = await pool.query(
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
  return result.rows;
}

module.exports = { listActiveEnrollments, listDueModules };