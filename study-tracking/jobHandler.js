require('dotenv').config();
const reminderService = require('./services/reminderService');

module.exports.handler = async () => {
  const summary = await reminderService.runJob();
  return { statusCode: 200, body: JSON.stringify(summary) };
};