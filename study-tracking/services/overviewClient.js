async function fetchOverview(days) {
  const base = process.env.INTERNAL_API_URL || 'http://localhost:3000';
  const res = await fetch(base + '/api/internal/overview?days=' + days, {
    headers: { 'x-api-key': process.env.INTERNAL_API_KEY },
  });
  if (!res.ok) throw new Error('Overview answered ' + res.status);
  const body = await res.json();
  return Array.isArray(body) ? body : body.enrollments || [];
}

module.exports = { fetchOverview };