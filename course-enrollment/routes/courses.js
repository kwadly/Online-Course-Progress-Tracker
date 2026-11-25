const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parseId, handleError } = require('../utils/http');
const courseService = require('../services/courseService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.status(200).json(await courseService.listPublished(req.query));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', requireAuth, requireRole('instructor'), async (req, res) => {
  try {
    res.status(201).json(await courseService.createCourse(req.user, req.body));
  } catch (err) {
    handleError(res, err);
  }
});

// 'mine' must come before '/:id', or Express would read "mine" as an id
router.get('/mine', requireAuth, requireRole('instructor'), async (req, res) => {
  try {
    res.status(200).json(await courseService.listMine(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    res.status(200).json(await courseService.getCourse(req.user, id));
  } catch (err) {
    handleError(res, err);
  }
});

router.put('/:id', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    res.status(200).json(await courseService.updateCourse(req.user, id, req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id/status', requireAuth, requireRole('instructor'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'course id must be a positive whole number' });
  }
  try {
    res.status(200).json(await courseService.changeStatus(req.user, id, req.body));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;