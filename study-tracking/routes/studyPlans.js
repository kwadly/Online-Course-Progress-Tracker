const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/http');
const studyPlanService = require('../services/studyPlanService');

const router = express.Router();

router.post('/study-plans/generate', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(201).json(await studyPlanService.generate(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/study-plans/current', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await studyPlanService.current(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;