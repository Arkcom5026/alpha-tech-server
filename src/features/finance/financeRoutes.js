// routes/financeRoutes.js
// Finance route bridge for feature/domain routes

const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
const dailyClosingRoutes = require('../src/features/finance/dailyClosing.routes');

router.use(verifyToken);
router.use('/', dailyClosingRoutes);

module.exports = router;
