require('dotenv').config();
const express = require('express');

if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY || !process.env.DATABASE_URL) {
  console.error('DATABASE_URL, JWT_SECRET and INTERNAL_API_KEY must be set in .env');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const internalRoutes = require('./routes/internal');
const courseRoutes = require('./routes/courses');
const moduleRoutes = require('./routes/modules');
const enrollmentRoutes = require('./routes/enrollments');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', moduleRoutes);
app.use('/api', enrollmentRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});