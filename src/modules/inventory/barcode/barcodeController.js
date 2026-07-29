'use strict';

const runtime = require('./runtime/barcodeRuntime');

const generateMissingBarcodes = (req, res) => runtime.generateMissingBarcodes(req, res);
const getBarcodesByReceiptId = (req, res) => runtime.getBarcodesByReceiptId(req, res);
const getBarcodesForPrintBatch = (req, res) => runtime.getBarcodesForPrintBatch(req, res);
const getReceiptsWithBarcodes = (req, res) => runtime.getReceiptsWithBarcodes(req, res);
const searchReprintReceipts = (req, res) => runtime.searchReprintReceipts(req, res);
const reprintBarcodes = (req, res) => runtime.reprintBarcodes(req, res);
const markReceiptAsCompleted = (req, res) => runtime.markReceiptAsCompleted(req, res);
const markBarcodesAsPrinted = (req, res) => runtime.markBarcodesAsPrinted(req, res);
const auditReceiptBarcodes = (req, res) => runtime.auditReceiptBarcodes(req, res);
const getReceiptsReadyToScanSN = (req, res) => runtime.getReceiptsReadyToScanSN(req, res);
const getReceiptsReadyToScan = (req, res) => runtime.getReceiptsReadyToScan(req, res);
const updateSerialNumber = (req, res) => runtime.updateSerialNumber(req, res);

module.exports = {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markReceiptAsCompleted,
  markBarcodesAsPrinted,
  auditReceiptBarcodes,
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
};
