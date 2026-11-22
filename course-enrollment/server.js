const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, status FROM courses WHERE status = 'published' ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if ([name, email, password, role].some((v) => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ error: 'email is not valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (!['student', 'instructor'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or instructor' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name.trim(), email.trim().toLowerCase(), passwordHash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});