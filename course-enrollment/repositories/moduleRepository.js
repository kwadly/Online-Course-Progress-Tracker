const pool = require('../db');

async function insert({ courseId, title, position, dueDate }) {
  const result = await pool.query(
    'INSERT INTO modules (course_id, title, position, due_date) VALUES ($1, $2, $3, $4) RETURNING id, course_id, title, position, due_date',
    [courseId, title, position, dueDate]
  );
  return result.rows[0];
}

async function findWithOwner(id) {
  const result = await pool.query(
    'SELECT m.id, c.instructor_id FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function update(id, { title, position, dueDate }) {
  const result = await pool.query(
    'UPDATE modules SET title = $1, position = $2, due_date = $3 WHERE id = $4 RETURNING id, course_id, title, position, due_date',
    [title, position, dueDate, id]
  );
  return result.rows[0];
}

async function countCompletions(moduleId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS n FROM module_completions WHERE module_id = $1',
    [moduleId]
  );
  return result.rows[0].n;
}

async function remove(id) {
  await pool.query('DELETE FROM modules WHERE id = $1', [id]);
}

async function listUpcoming(studentId, days) {
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
    [studentId, days]
  );
  return result.rows;
}

module.exports = { insert, findWithOwner, update, countCompletions, remove, listUpcoming };