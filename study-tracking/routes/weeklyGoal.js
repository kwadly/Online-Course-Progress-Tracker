const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/http');
const service = require('../services/weeklyGoalService');

const router = express.Router();

router.put('/weekly-goal', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await service.setGoal(req.user, req.body || {}));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/weekly-goal', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await service.getGoal(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/study/weekly-summary', requireAuth, requireRole('student'), async (req, res) => {  try {
    res.status(200).json(await service.getSummary(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;