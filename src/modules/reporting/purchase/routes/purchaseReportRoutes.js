// Purchase reporting runtime routes
const express = require('express');
const router = express.Router();

const {
  getPurchaseReport,
  getPurchaseReceiptReport,
  getPurchaseReceiptReportDetail,
} = require('../../../../../controllers/purchaseReportController');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getPurchaseReport);
router.get('/receipts', getPurchaseReceiptReport);
router.get('/receipts/:receiptId', getPurchaseReceiptReportDetail);

module.exports = router;
