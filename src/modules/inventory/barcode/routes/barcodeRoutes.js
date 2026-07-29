// src/modules/inventory/barcode/routes/barcodeRoutes.js

const express = require('express');
const router = express.Router();

const {
  markReceiptAsCompleted,
  auditReceiptBarcodes,
} = require('../../../../../controllers/barcodeController');
const {
  generateMissingBarcodes,
} = require('../generate/generateBarcodeController');
const {
  getBarcodesByReceiptId,
} = require('../query/receiptBarcodeQueryController');
const {
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markBarcodesAsPrinted,
} = require('../print/barcodePrintController');
const {
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
} = require('../scan/barcodeScanController');
const verifyToken = require('../../../../../middlewares/verifyToken');

router.use(verifyToken);

router.post('/generate-missing/:receiptId', generateMissingBarcodes);
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);
router.get('/receipt/:receiptId/audit', auditReceiptBarcodes);
router.get('/print-batch', getBarcodesForPrintBatch);
router.get('/with-barcodes', getReceiptsWithBarcodes);
router.get('/receipts-with-barcodes', getReceiptsWithBarcodes);
router.get('/ready-to-scan-sn', getReceiptsReadyToScanSN);
router.get('/receipts-ready-to-scan-sn', getReceiptsReadyToScanSN);
router.get('/ready-to-scan', getReceiptsReadyToScan);
router.get('/receipts-ready-to-scan', getReceiptsReadyToScan);
router.get('/reprint-search', searchReprintReceipts);
router.patch('/update-serial-number', updateSerialNumber);
router.patch('/mark-printed', markBarcodesAsPrinted);
router.patch('/reprint/:receiptId', reprintBarcodes);
router.patch('/receipts/:receiptId/complete', markReceiptAsCompleted);
router.patch('/receipts/:id/complete', markReceiptAsCompleted);

module.exports = router;