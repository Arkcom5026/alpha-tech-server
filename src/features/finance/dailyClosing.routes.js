// src/features/finance/dailyClosing.routes.js

const express = require('express');
const router = express.Router();

const verifyToken = require('../../../middlewares/verifyToken');
const { getDailyClosingSummary } = require('./dailyClosing.controller');

router.use(verifyToken);

// GET /api/finance/daily-closing-summary?date=YYYY-MM-DD
router.get('/daily-closing-summary', getDailyClosingSummary);

module.exports = router;
