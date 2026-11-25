const express = require('express');
const { handleError } = require('../utils/http');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/login', async (req, res) => {
  try {
    res.status(200).json(await authService.login(req.body));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    res.status(200).json(await authService.getMe(req.user));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;