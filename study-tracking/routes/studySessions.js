const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/http');
const studySessionService = require('../services/studySessionService');

const router = express.Router();

router.post('/study-sessions', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(201).json(await studySessionService.logSession(req.user, req.body || {}));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/study-sessions', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await studySessionService.listMine(req.user, req.query));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;