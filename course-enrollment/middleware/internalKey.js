const crypto = require('crypto');

function requireInternalKey(req, res, next) {
  const given = Buffer.from(String(req.headers['x-api-key'] || ''));
  const expected = Buffer.from(process.env.INTERNAL_API_KEY);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Missing or invalid internal key' });
  }
  next();
}

module.exports = { requireInternalKey };