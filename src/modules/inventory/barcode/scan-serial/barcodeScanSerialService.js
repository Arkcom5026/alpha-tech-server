const repository = require('./barcodeScanSerialRepository');

const toInt = (value) => (
  value === undefined || value === null || value === '' ? undefined : Number(value)
);

const listReadyToScanSn = async ({ branchId }) => {
  const receipts = await repository.findReadyToScanSnReceipts({ branchId });
  return receipts
    .map((receipt) => {
      const isSn = (item) => item.kind === 'SN' || (item.stockItemId != null && !item.simpleLotId);
      const totalSN = receipt.barcodeReceiptItem.filter(isSn).length;
      const scannedSN = receipt.barcodeReceiptItem.filter((item) => isSn(item) && item.stockItemId != null).length;
      return {
        id: receipt.id,
        code: receipt.code,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: receipt.purchaseOrder?.supplier?.name || '-',
        createdAt: receipt.createdAt,
        totalSN,
        scannedSN,
        pendingSN: Math.max(0, totalSN - scannedSN),
      };
    })
    .filter((receipt) => receipt.pendingSN > 0);
};

const listReadyToScan = async ({ branchId }) => {
  const receipts = await repository.findReadyToScanReceipts({ branchId });
  return receipts
    .map((receipt) => {
      const items = receipt.barcodeReceiptItem || [];
      const isSn = (item) => item.kind === 'SN' || (item.stockItemId != null && !item.simpleLotId);
      const isLot = (item) => item.kind === 'LOT' || item.simpleLotId != null;
      const totalSN = items.filter(isSn).length;
      const scannedSN = items.filter((item) => isSn(item) && item.stockItemId != null).length;
      const totalLOT = items.filter(isLot).length;
      const activatedLOT = items.filter((item) => isLot(item) && item.status === 'SN_RECEIVED').length;
      const pendingSN = Math.max(0, totalSN - scannedSN);
      const pendingLOT = Math.max(0, totalLOT - activatedLOT);
      return {
        id: receipt.id,
        code: receipt.code,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: receipt.purchaseOrder?.supplier?.name || '-',
        createdAt: receipt.createdAt,
        totalSN,
        scannedSN,
        pendingSN,
        totalLOT,
        activatedLOT,
        pendingLOT,
        pendingTotal: pendingSN + pendingLOT,
      };
    })
    .filter((receipt) => receipt.pendingTotal > 0);
};

const changeSerialNumber = async ({ branchId, barcode, serialNumber }) => {
  const barcodeRow = await repository.findBarcodeWithStockItem({ branchId, barcode });
  if (!barcodeRow) {
    const error = new Error('BARCODE_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  if (!barcodeRow.stockItemId) {
    const error = new Error('STOCK_ITEM_NOT_LINKED');
    error.status = 400;
    throw error;
  }

  const stockItem = barcodeRow.stockItem;
  if (String(stockItem?.status || '').toUpperCase() === 'SOLD' || stockItem?.soldAt != null) {
    const error = new Error('STOCK_ITEM_SOLD');
    error.status = 400;
    throw error;
  }

  const duplicate = await repository.findDuplicateSerial({
    branchId,
    serialNumber,
    excludeStockItemId: stockItem.id,
  });
  if (duplicate) {
    const error = new Error('SERIAL_DUPLICATE');
    error.status = 400;
    throw error;
  }

  return repository.updateStockItemSerial({ stockItemId: stockItem.id, serialNumber });
};

module.exports = {
  toInt,
  listReadyToScanSn,
  listReadyToScan,
  changeSerialNumber,
};
