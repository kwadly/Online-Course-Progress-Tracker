const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseId, handleError } = require('../utils/http');
const enrollmentService = require('../services/enrollmentService');

const router = express.Router();

router.post('/courses/:id/enroll', requireAuth, requireRole('student'), async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    const { created, enrollment } = await enrollmentService.enroll(req.user, courseId);
    res.status(created ? 201 : 200).json(enrollment);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/enrollments/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    res.status(200).json(await enrollmentService.listMine(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/enrollments/:id/drop', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'enrollment id must be a positive whole number' });
  }
  try {
    res.status(200).json(await enrollmentService.drop(req.user, id));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/enrollments/:id/modules/:moduleId/complete', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  const moduleId = parseId(req.params.moduleId);
  if (!id || !moduleId) {
    return res.status(400).json({ error: 'ids must be positive whole numbers' });
  }
  try {
    res.status(201).json(await enrollmentService.completeModule(req.user, id, moduleId));
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/enrollments/:id/modules/:moduleId/complete', requireAuth, requireRole('student'), async (req, res) => {
  const id = parseId(req.params.id);
  const moduleId = parseId(req.params.moduleId);
  if (!id || !moduleId) {
    return res.status(400).json({ error: 'ids must be positive whole numbers' });
  }
  try {
    res.status(200).json(await enrollmentService.undoModule(req.user, id, moduleId));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/courses/:id/stats', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    res.status(200).json(await enrollmentService.courseStats(req.user, id));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;