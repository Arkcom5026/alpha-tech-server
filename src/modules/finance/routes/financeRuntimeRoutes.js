const express = require('express');
const router = express.Router();

const financeRuntimeController = require('../runtime/financeRuntimeController');
const verifyToken = require('../../../../middlewares/verifyToken');
const dailyClosingRoutes = require('../daily-closing/routes/dailyClosingRoutes');
const storePaymentAccountRoutes = require('../store-payment-account/storePaymentAccountRoutes');

router.use(verifyToken);
router.use('/', dailyClosingRoutes);
router.use('/store-payment-accounts', storePaymentAccountRoutes);

router.get('/ar/summary', financeRuntimeController.getAccountsReceivableSummary);
router.get('/ar', financeRuntimeController.getAccountsReceivableRows);
router.get('/customer-credit/summary', financeRuntimeController.getCustomerCreditSummary);
router.get('/customer-credit', financeRuntimeController.getCustomerCreditRows);
router.get('/customer-credit/:customerId', financeRuntimeController.getCustomerCreditByCustomerId);
router.get('/ping', financeRuntimeController.pingFinance);

module.exports = router;