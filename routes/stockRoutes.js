






// ✅ stockRoutes.js — Routing สำหรับโมดูล Stock (Dashboard subset)
// แนวคิด: Dashboard เป็น “ส่วนหนึ่งของ Stock” ไม่แยกโมดูลใหม่

const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// -----------------------------
// Dashboard (manual-load per block)
// Base path (mounted in server.js):
//   app.use('/api/stock/dashboard', stockRoutes);
// แล้ว endpoint จะเป็น:
//   GET /api/stock/dashboard/overview
//   GET /api/stock/dashboard/audit-in-progress
//   GET /api/stock/dashboard/risk
// -----------------------------
const {
  getStockDashboardOverview,
  getStockDashboardAuditInProgress,
  getStockDashboardRisk,
} = require('../controllers/stockController');

router.get('/overview', getStockDashboardOverview);
router.get('/audit-in-progress', getStockDashboardAuditInProgress);
router.get('/risk', getStockDashboardRisk);

module.exports = router;




