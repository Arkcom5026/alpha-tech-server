// ============================================================
// Finance runtime compatibility routes
// ============================================================

const express = require('express');
const router = express.Router();

const financeController = require('../../../controllers/financeController');
const verifyToken = require('../../../../middlewares/verifyToken');
const dailyClosingRoutes = require('../../../../src/features/finance/dailyClosing.routes');

router.use(verifyToken);

router.use('/', dailyClosingRoutes);

router.get('/ar/summary', financeController.getAccountsReceivableSummary);
router.get('/ar', financeController.getAccountsReceivableRows);

router.get('/customer-credit/summary', financeController.getCustomerCreditSummary);
router.get('/customer-credit', financeController.getCustomerCreditRows);
router.get('/customer-credit/:customerId', financeController.getCustomerCreditByCustomerId);

router.get('/ping', financeController.pingFinance);

module.exports = router;
