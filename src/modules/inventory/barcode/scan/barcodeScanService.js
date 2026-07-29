'use strict';

const scanRepository = require('./barcodeScanRepository');

const isSNBarcode = (item) =>
  item.kind === 'SN' || (item.stockItemId != null && !item.simpleLotId);

const isLOTBarcode = (item) => item.kind === 'LOT' || item.simpleLotId != null;

const projectReceiptIdentity = (receipt) => ({
  id: receipt.id,
  code: receipt.code,
  purchaseOrderCode: receipt.purchaseOrder?.code || '-',
  supplier: receipt.purchaseOrder?.supplier?.name || '-',
  createdAt: receipt.createdAt,
});

const getReceiptsReadyToScanSN = async ({ branchId }) => {
  const receipts = await scanRepository.findReceiptsWithSNBarcodes({ branchId });

  return receipts
    .map((receipt) => {
      const items = receipt.barcodeReceiptItem || [];
      const totalSN = items.filter(isSNBarcode).length;
      const scannedSN = items.filter(
        (item) => isSNBarcode(item) && item.stockItemId != null
      ).length;
      const pendingSN = Math.max(0, totalSN - scannedSN);

      return {
        ...projectReceiptIdentity(receipt),
        totalSN,
        scannedSN,
        pendingSN,
      };
    })
    .filter((receipt) => receipt.pendingSN > 0);
};

const getReceiptsReadyToScan = async ({ branchId }) => {
  const receipts = await scanRepository.findReceiptsWithBarcodes({ branchId });

  return receipts
    .map((receipt) => {
      const items = receipt.barcodeReceiptItem || [];
      const totalSN = items.filter(isSNBarcode).length;
      const scannedSN = items.filter(
        (item) => isSNBarcode(item) && item.stockItemId != null
      ).length;
      const pendingSN = Math.max(0, totalSN - scannedSN);

      const totalLOT = items.filter(isLOTBarcode).length;
      const activatedLOT = items.filter(
        (item) => isLOTBarcode(item) && item.status === 'SN_RECEIVED'
      ).length;
      const pendingLOT = Math.max(0, totalLOT - activatedLOT);
      const pendingTotal = pendingSN + pendingLOT;

      return {
        ...projectReceiptIdentity(receipt),
        totalSN,
        scannedSN,
        pendingSN,
        totalLOT,
        activatedLOT,
        pendingLOT,
        pendingTotal,
      };
    })
    .filter((receipt) => receipt.pendingTotal > 0);
};

const updateSerialNumber = async ({ branchId, barcode, serialNumber }) => {
  const barcodeRow = await scanRepository.findBarcodeWithStockItem({ branchId, barcode });
  if (!barcodeRow) return { code: 'BARCODE_NOT_FOUND' };
  if (!barcodeRow.stockItemId || !barcodeRow.stockItem) return { code: 'STOCK_ITEM_MISSING' };

  const stockItem = barcodeRow.stockItem;
  if (
    String(stockItem.status || '').toUpperCase() === 'SOLD' ||
    stockItem.soldAt != null
  ) {
    return { code: 'STOCK_ITEM_SOLD' };
  }

  const duplicate = await scanRepository.findDuplicateSerial({
    branchId,
    serialNumber,
    stockItemId: stockItem.id,
  });
  if (duplicate) return { code: 'SERIAL_DUPLICATE' };

  const updated = await scanRepository.updateStockItemSerial({
    stockItemId: stockItem.id,
    serialNumber,
  });
  return { code: 'UPDATED', stockItem: updated };
};

module.exports = {
  isSNBarcode,
  isLOTBarcode,
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
};