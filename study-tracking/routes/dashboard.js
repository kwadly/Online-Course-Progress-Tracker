const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/http');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await dashboardService.getDashboard(req.user, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;