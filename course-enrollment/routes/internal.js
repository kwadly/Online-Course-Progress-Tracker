const express = require('express');
const { requireInternalKey } = require('../middleware/internalKey');
const { handleError } = require('../utils/http');
const internalService = require('../services/internalService');

const router = express.Router();

router.get('/overview', requireInternalKey, async (req, res) => {
  try {
    res.status(200).json(await internalService.overview(req.query.days));
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;