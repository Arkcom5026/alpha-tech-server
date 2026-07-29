// ============================================================
// 📁 FILE: server/routes/financeRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();

const financeController = require('../controllers/financeController');
const verifyToken = require('../middlewares/verifyToken');

// ✅ Daily Closing Confidence routes
// New domain/feature route lives under server/src/features/finance
const dailyClosingRoutes = require('../src/features/finance/dailyClosing.routes');

// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

// Daily Closing Confidence
router.use('/', dailyClosingRoutes);

// Accounts Receivable (AR)
router.get('/ar/summary', financeController.getAccountsReceivableSummary);
router.get('/ar', financeController.getAccountsReceivableRows);

// Customer Credit
router.get('/customer-credit/summary', financeController.getCustomerCreditSummary);
router.get('/customer-credit', financeController.getCustomerCreditRows);
router.get('/customer-credit/:customerId', financeController.getCustomerCreditByCustomerId);

// Health
router.get('/ping', financeController.pingFinance);

module.exports = router;
