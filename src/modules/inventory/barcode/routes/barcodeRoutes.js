// src/modules/inventory/barcode/routes/barcodeRoutes.js

const express = require('express');
const router = express.Router();

const {
  generateMissingBarcodes,
} = require('../generation/generateMissingBarcodesController');
const {
  getBarcodesByReceiptId,
} = require('../receipt-query/getBarcodesByReceiptIdController');
const {
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markBarcodesAsPrinted,
} = require('../print-reprint/barcodePrintReprintController');
const {
  auditReceiptBarcodes,
} = require('../audit/barcodeAuditController');
const {
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
} = require('../scan-serial/barcodeScanSerialController');
const {
  markReceiptAsCompleted,
} = require('../runtime/barcodeController');
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
