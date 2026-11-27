const app = require('./app');
const reminderService = require('./services/reminderService');

const PORT = 3002;
app.listen(PORT, () => {
  console.log('Study tracking running on http://localhost:' + PORT);
});

// Daily reminder job (local only; on AWS, EventBridge triggers jobHandler.js)
setInterval(() => {
  reminderService.runJob().catch((err) => console.error('Reminder job failed: ' + err.message));
}, 24 * 60 * 60 * 1000);