const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseId, httpError, handleError } = require('../utils/http');
const activityService = require('../services/activityService');

const router = express.Router();

router.get('/courses/:id/activity', requireAuth, requireRole('instructor'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) throw httpError(400, 'Invalid course id');
    res.status(200).json(await activityService.courseActivity(req.user, id));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;