require('dotenv').config();
const express = require('express');

if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY || !process.env.DATABASE_URL) {
  console.error('DATABASE_URL, JWT_SECRET and INTERNAL_API_KEY must be set');
  process.exit(1);
}

if (!process.env.DISCORD_WEBHOOK_URL) {
  console.warn('DISCORD_WEBHOOK_URL is not set: reminders will be created but not sent');
}

const studySessionRoutes = require('./routes/studySessions');
const weeklyGoalRoutes = require('./routes/weeklyGoal');
const dashboardRoutes = require('./routes/dashboard');
const reminderRoutes = require('./routes/reminders');
const studyPlanRoutes = require('./routes/studyPlans');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', studySessionRoutes);
app.use('/api', weeklyGoalRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', reminderRoutes);
app.use('/api', studyPlanRoutes);

module.exports = app;