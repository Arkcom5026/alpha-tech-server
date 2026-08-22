const express = require('express');
const router = express.Router();

const financeRuntimeController = require('../runtime/financeRuntimeController');
const verifyToken = require('../../../../middlewares/verifyToken');
const dailyClosingRoutes = require('../daily-closing/routes/dailyClosingRoutes');
const storePaymentAccountRoutes = require('../store-payment-account/storePaymentAccountRoutes');
const {
  FINANCE_RUNTIME_CAPABILITY,
  allowFinanceRuntimeCapabilities,
} = require('../runtime/financeRuntimeAuthorization');

const allowReceivablesRead = allowFinanceRuntimeCapabilities(
  FINANCE_RUNTIME_CAPABILITY.RECEIVABLES_READ,
);

router.use(verifyToken);
router.use('/', dailyClosingRoutes);
router.use('/store-payment-accounts', storePaymentAccountRoutes);

router.get('/ar/summary', allowReceivablesRead, financeRuntimeController.getAccountsReceivableSummary);
router.get('/ar', allowReceivablesRead, financeRuntimeController.getAccountsReceivableRows);
router.get('/customer-credit/summary', allowReceivablesRead, financeRuntimeController.getCustomerCreditSummary);
router.get('/customer-credit', allowReceivablesRead, financeRuntimeController.getCustomerCreditRows);
router.get('/customer-credit/:customerId', allowReceivablesRead, financeRuntimeController.getCustomerCreditByCustomerId);
router.get('/ping', financeRuntimeController.pingFinance);

module.exports = router;