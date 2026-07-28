const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { createPayments } = require('../create/createPaymentController');
const {
  searchPrintablePayments,
} = require('../query/printable/searchPrintablePaymentsController');
const { cancelPayment } = require('../cancel/cancelPaymentController');

const router = express.Router();

router.use(verifyToken);
router.post('/', createPayments);
router.get('/printable', searchPrintablePayments);
router.post('/cancel', cancelPayment);

module.exports = router;
