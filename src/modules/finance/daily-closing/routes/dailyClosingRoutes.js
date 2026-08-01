const express = require('express');

const router = express.Router();
const verifyToken = require('../../../../../middlewares/verifyToken');
const {
  getDailyClosingSummary,
} = require('../runtime/dailyClosingRuntimeController');

router.use(verifyToken);
router.get('/daily-closing-summary', getDailyClosingSummary);

module.exports = router;
