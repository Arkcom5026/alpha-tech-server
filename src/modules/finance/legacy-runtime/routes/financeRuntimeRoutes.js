// ============================================================
// Finance runtime compatibility routes
// ============================================================

const express = require('express');
const router = express.Router();

const financeRuntimeController = require('../financeRuntimeController');
const verifyToken = require('../../../../../middlewares/verifyToken');
const dailyClosingRoutes = require('../../daily-closing/routes/dailyClosingRoutes');

router.use(verifyToken);

router.use('/', dailyClosingRoutes);

router.get('/ar/summary', financeRuntimeController.getAccountsReceivableSummary);
router.get('/ar', financeRuntimeController.getAccountsReceivableRows);

router.get('/customer-credit/summary', financeRuntimeController.getCustomerCreditSummary);
router.get('/customer-credit', financeRuntimeController.getCustomerCreditRows);
router.get('/customer-credit/:customerId', financeRuntimeController.getCustomerCreditByCustomerId);

router.get('/ping', financeRuntimeController.pingFinance);

module.exports = router;
