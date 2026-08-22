const express = require('express');

const router = express.Router();
const verifyToken = require('../../../../../middlewares/verifyToken');
const {
  getDailyClosingSummary,
} = require('../runtime/dailyClosingRuntimeController');
const {
  requireDailyClosingRead,
} = require('../shared/dailyClosingAuthorization');

router.use(verifyToken);
router.get('/daily-closing-summary', requireDailyClosingRead, getDailyClosingSummary);

module.exports = router;
