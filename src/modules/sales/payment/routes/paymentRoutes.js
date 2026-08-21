const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { createPayments } = require('../create/createPaymentController');
const {
  searchPrintablePayments,
} = require('../query/printable/searchPrintablePaymentsController');
const { cancelPayment } = require('../cancel/cancelPaymentController');
const {
  PAYMENT_CAPABILITY,
  allowPaymentCapabilities,
} = require('../shared/paymentAuthorization');

const router = express.Router();
const allowPaymentRead = allowPaymentCapabilities(PAYMENT_CAPABILITY.READ);
const allowPaymentManage = allowPaymentCapabilities(PAYMENT_CAPABILITY.MANAGE);
const allowPaymentCancel = allowPaymentCapabilities(
  PAYMENT_CAPABILITY.MANAGE,
  PAYMENT_CAPABILITY.CANCEL,
);

router.use(verifyToken);
router.post('/', allowPaymentManage, createPayments);
router.get('/printable', allowPaymentRead, searchPrintablePayments);
router.post('/cancel', allowPaymentCancel, cancelPayment);

module.exports = router;
