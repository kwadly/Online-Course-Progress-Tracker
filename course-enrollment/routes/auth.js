const express = require('express');
const { handleError } = require('../utils/http');
const authService = require('../services/authService');

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

module.exports = router;