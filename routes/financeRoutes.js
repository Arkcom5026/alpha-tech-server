

// ============================================================
// 📁 FILE: server/routes/financeRoutes.js
// ============================================================

const express = require('express');
const router = express.Router();

const financeController = require('../controllers/financeController');
const verifyToken = require('../middlewares/verifyToken');

// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

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

