const { prisma } = require('../../../../../lib/prisma');
const { measurePerformance } = require('../../../../../lib/performanceTiming');

const barcodeReceiptItemSelect = {
  kind: true,
  stockItemId: true,
  simpleLotId: true,
  status: true,
  receiptItem: {
    select: {
      product: { select: { mode: true } },
      purchaseOrderItem: {
        select: { product: { select: { mode: true } } },
      },
    },
  },
};

// This is intentionally a conservative superset of the service-level pending
// rules. It removes receipts whose barcode rows are all fully received while
// keeping the service as the final authority for SN/LOT classification.
const pendingReceiptCandidateWhere = (branchId) => ({
  branchId,
  barcodeReceiptItem: {
    some: {
      OR: [
        { status: { not: 'SN_RECEIVED' } },
        { stockItemId: null },
      ],
    },
  },
});

const findReadyToScanSnReceipts = ({ branchId }) => measurePerformance(
  'barcodes.readyToScan.repo.snReceipts',
  () => prisma.purchaseOrderReceipt.findMany({
    where: pendingReceiptCandidateWhere(branchId),
    include: {
      purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      barcodeReceiptItem: { select: barcodeReceiptItemSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }),
);

const findReadyToScanReceipts = ({ branchId }) => measurePerformance(
  'barcodes.readyToScan.repo.receipts',
  () => prisma.purchaseOrderReceipt.findMany({
    where: pendingReceiptCandidateWhere(branchId),
    include: {
      purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      barcodeReceiptItem: { select: barcodeReceiptItemSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }),
);

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
