const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/http');
const reminderService = require('../services/reminderService');

const router = express.Router();

function requireInternalKey(req, res, next) {
  if (req.headers['x-api-key'] !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }
  next();
}

router.get('/reminders', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await reminderService.listMine(req.user, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/reminders/run', requireInternalKey, async (req, res) => {
  try {
    res.status(200).json(await reminderService.runJob());
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;