const repository = require('./barcodeScanSerialRepository');

const toInt = (value) => (
  value === undefined || value === null || value === '' ? undefined : Number(value)
);

const getReceiveMode = (item) => (
  item?.receiptItem?.purchaseOrderItem?.product?.mode ||
  item?.receiptItem?.product?.mode ||
  null
);

const classifyBarcodeIdentity = (item) => {
  const mode = getReceiveMode(item);
  if (mode === 'STRUCTURED') return 'SN';
  if (mode === 'SIMPLE') return 'LOT';
  if (item?.kind === 'SN' || (item?.stockItemId != null && !item?.simpleLotId)) return 'SN';
  if (item?.kind === 'LOT' || item?.simpleLotId != null) return 'LOT';
  return null;
};

const summarizeReceiptPending = (receipt) => {
  const items = receipt?.barcodeReceiptItem || [];
  const isSn = (item) => classifyBarcodeIdentity(item) === 'SN';
  const isLot = (item) => classifyBarcodeIdentity(item) === 'LOT';
  const totalSN = items.filter(isSn).length;
  const scannedSN = items.filter((item) => isSn(item) && item.stockItemId != null).length;
  const totalLOT = items.filter(isLot).length;
  const activatedLOT = items.filter((item) => isLot(item) && item.status === 'SN_RECEIVED').length;
  const pendingSN = Math.max(0, totalSN - scannedSN);
  const pendingLOT = Math.max(0, totalLOT - activatedLOT);

  return {
    totalSN,
    scannedSN,
    pendingSN,
    totalLOT,
    activatedLOT,
    pendingLOT,
    pendingTotal: pendingSN + pendingLOT,
  };
};

const listReadyToScanSn = async ({ branchId }) => {
  const receipts = await repository.findReadyToScanSnReceipts({ branchId });
  return receipts
    .map((receipt) => {
      const summary = summarizeReceiptPending(receipt);
      return {
        id: receipt.id,
        code: receipt.code,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: receipt.purchaseOrder?.supplier?.name || '-',
        createdAt: receipt.createdAt,
        totalSN: summary.totalSN,
        scannedSN: summary.scannedSN,
        pendingSN: summary.pendingSN,
      };
    })
    .filter((receipt) => receipt.pendingSN > 0);
};

const listReadyToScan = async ({ branchId }) => {
  const receipts = await repository.findReadyToScanReceipts({ branchId });
  return receipts
    .map((receipt) => {
      const summary = summarizeReceiptPending(receipt);
      return {
        id: receipt.id,
        code: receipt.code,
        purchaseOrderCode: receipt.purchaseOrder?.code || '-',
        supplier: receipt.purchaseOrder?.supplier?.name || '-',
        createdAt: receipt.createdAt,
        ...summary,
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
  getReceiveMode,
  classifyBarcodeIdentity,
  summarizeReceiptPending,
  listReadyToScanSn,
  listReadyToScan,
  changeSerialNumber,
};
