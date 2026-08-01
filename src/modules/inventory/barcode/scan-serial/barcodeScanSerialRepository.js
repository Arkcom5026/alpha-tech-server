const { prisma } = require('../../../../../lib/prisma');

const findReadyToScanSnReceipts = ({ branchId }) => prisma.purchaseOrderReceipt.findMany({
  where: {
    branchId,
    barcodeReceiptItem: { some: { OR: [{ kind: 'SN' }, { stockItemId: { not: null } }] } },
  },
  include: {
    purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
    barcodeReceiptItem: { select: { kind: true, stockItemId: true, simpleLotId: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 200,
});

const findReadyToScanReceipts = ({ branchId }) => prisma.purchaseOrderReceipt.findMany({
  where: { branchId, barcodeReceiptItem: { some: {} } },
  include: {
    purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
    barcodeReceiptItem: { select: { kind: true, stockItemId: true, simpleLotId: true, status: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 200,
});

const findBarcodeWithStockItem = ({ branchId, barcode }) => prisma.barcodeReceiptItem.findFirst({
  where: { barcode, branchId },
  include: { stockItem: true },
});

const findDuplicateSerial = ({ branchId, serialNumber, excludeStockItemId }) => prisma.stockItem.findFirst({
  where: {
    branchId,
    serialNumber,
    NOT: { id: excludeStockItemId },
  },
  select: { id: true },
});

const updateStockItemSerial = ({ stockItemId, serialNumber }) => prisma.stockItem.update({
  where: { id: stockItemId },
  data: { serialNumber },
});

module.exports = {
  findReadyToScanSnReceipts,
  findReadyToScanReceipts,
  findBarcodeWithStockItem,
  findDuplicateSerial,
  updateStockItemSerial,
};
