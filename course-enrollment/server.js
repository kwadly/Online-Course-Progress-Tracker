const express = require('express');
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});