const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseId, handleError } = require('../utils/http');
const moduleService = require('../services/moduleService');

const router = express.Router();

router.post('/courses/:id/modules', requireAuth, requireRole('instructor'), async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    res.status(201).json(await moduleService.createModule(req.user, courseId, req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/modules/upcoming', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await moduleService.listUpcoming(req.user, req.query.days));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/modules/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'module id must be a positive whole number' });
  }
  try {
    res.status(200).json(await moduleService.updateModule(req.user, id, req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/modules/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'module id must be a positive whole number' });
  }
  try {
    await moduleService.deleteModule(req.user, id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;