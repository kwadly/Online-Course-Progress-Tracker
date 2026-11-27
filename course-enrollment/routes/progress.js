const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseId, httpError, handleError } = require('../utils/http');
const progressService = require('../services/progressService');

const router = express.Router();

router.get('/enrollments/:id/completed', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) throw httpError(400, 'Invalid enrollment id');
    res.status(200).json(await progressService.completedModules(req.user, id));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;