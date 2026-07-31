const legacy = require('../runtime/barcodeController');

module.exports = {
  getBarcodesForPrintBatch: legacy.getBarcodesForPrintBatch,
  getReceiptsWithBarcodes: legacy.getReceiptsWithBarcodes,
  searchReprintReceipts: legacy.searchReprintReceipts,
  reprintBarcodes: legacy.reprintBarcodes,
  markBarcodesAsPrinted: legacy.markBarcodesAsPrinted,
};
