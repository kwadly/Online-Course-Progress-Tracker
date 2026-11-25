require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const internalRoutes = require('./routes/internal');
const courseRoutes = require('./routes/courses');
const moduleRoutes = require('./routes/modules');
const enrollmentRoutes = require('./routes/enrollments');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', moduleRoutes);
app.use('/api', enrollmentRoutes);

module.exports = app;