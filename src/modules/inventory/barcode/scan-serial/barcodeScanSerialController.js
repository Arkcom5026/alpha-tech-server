const legacy = require('../runtime/barcodeController');

module.exports = {
  getReceiptsReadyToScanSN: legacy.getReceiptsReadyToScanSN,
  getReceiptsReadyToScan: legacy.getReceiptsReadyToScan,
  updateSerialNumber: legacy.updateSerialNumber,
};
