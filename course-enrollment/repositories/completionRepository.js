const pool = require('../db');

async function moduleIds(enrollmentId) {
  const result = await pool.query(
    'SELECT module_id FROM module_completions WHERE enrollment_id = $1',
    [enrollmentId]
  );
  return result.rows.map((r) => r.module_id);
}

module.exports = { moduleIds };