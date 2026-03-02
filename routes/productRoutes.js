
// ============================================================
// 📁 FILE: routes/financeRoutes.js
// ✅ Align routes with FE financeApi.js (AR + Customer Credit)
// Base mount: app.use('/api/finance', financeRoutes)
// ============================================================

const express = require('express');
const router = express.Router();

const financeController = require('../controllers/financeController');

// ✅ Auth / Scope (Single Source of Truth)
// จากโครงสร้างจริงของโปรเจกต์นี้ (อ้างอิง productRoutes.js) ใช้ verifyToken เป็น middleware กลาง
const verifyToken = require('../middlewares/verifyToken');

// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

// ------------------------------
// Accounts Receivable (AR)
// ------------------------------
// GET /api/finance/ar/summary
router.get('/ar/summary', financeController.getAccountsReceivableSummary);
// GET /api/finance/ar
router.get('/ar', financeController.getAccountsReceivableRows);

// ------------------------------
// Customer Credit
// ------------------------------
// GET /api/finance/customer-credit/summary
router.get('/customer-credit/summary', financeController.getCustomerCreditSummary);
// GET /api/finance/customer-credit
router.get('/customer-credit', financeController.getCustomerCreditRows);

// Optional drill-in (future)
// GET /api/finance/customer-credit/:customerId
router.get(
  '/customer-credit/:customerId',
  financeController.getCustomerCreditByCustomerId
);

// Health
router.get('/ping', financeController.pingFinance);

module.exports = router;



