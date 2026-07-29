const express = require('express');
const router = express.Router();

const { getDailyClosingSummary } = require('../dailyClosingController');

router.get('/daily-closing-summary', getDailyClosingSummary);

module.exports = router;
