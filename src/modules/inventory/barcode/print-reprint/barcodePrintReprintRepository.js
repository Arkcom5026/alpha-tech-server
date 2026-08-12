const { prisma } = require('../../../../../lib/prisma');

const findReceiptBarcodeCoverage = (branchId, receiptIds) =>
  prisma.barcodeReceiptItem.findMany({
    where: { branchId, purchaseOrderReceiptId: { in: receiptIds } },
    select: { purchaseOrderReceiptId: true },
    distinct: ['purchaseOrderReceiptId'],
  });

const findPrintBatchRows = (branchId, receiptIds) =>
  prisma.barcodeReceiptItem.findMany({
    where: { branchId, purchaseOrderReceiptId: { in: receiptIds } },
    select: {
      id: true,
      barcode: true,
      printed: true,
      kind: true,
      status: true,
      purchaseOrderReceiptId: true,
      receiptItemId: true,
      simpleLotId: true,
      stockItemId: true,
      stockItem: { select: { productId: true } },
      receiptItem: {
        select: {
          quantity: true,
          purchaseOrderItem: { select: { productId: true } },
        },
      },
    },
    orderBy: [{ purchaseOrderReceiptId: 'asc' }, { id: 'asc' }],
  });

const findProductsByIds = (ids) =>
  prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });

// Print confirmation is operational metadata and deliberately idempotent.
// Use the root Prisma delegates directly instead of the stock-movement
// transaction proxy. If the second update ever fails, retrying is safe:
// the barcode update becomes a no-op and the receipt update is retried.
const markReceiptPrinted = async (branchId, purchaseOrderReceiptId) => {
  const barcodeResult = await prisma.barcodeReceiptItem.updateMany({
    where: { branchId, purchaseOrderReceiptId, printed: false },
    data: { printed: true },
  });

  const receiptResult = await prisma.purchaseOrderReceipt.updateMany({
    where: { id: purchaseOrderReceiptId, branchId },
    data: { printed: true },
  });

  // Preserve the existing service contract.
  return [barcodeResult, receiptResult];
};

const findReceiptsWaitingForPrint = (branchId) =>
  prisma.purchaseOrderReceipt.findMany({
    where: { branchId, barcodeReceiptItem: { some: { printed: false } } },
    include: {
      purchaseOrder: {
        select: {
          code: true,
          supplier: { select: { name: true, creditLimit: true, creditBalance: true } },
        },
      },
      barcodeReceiptItem: { select: { id: true, printed: true, kind: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

const searchReceiptsForReprint = (where, limit) =>
  prisma.purchaseOrderReceipt.findMany({
    where,
    include: {
      purchaseOrder: {
        select: {
          code: true,
          supplier: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

const findReceipt = (receiptId, branchId, select = { id: true }) =>
  prisma.purchaseOrderReceipt.findFirst({ where: { id: receiptId, branchId }, select });

const findReprintItems = (receiptId, branchId) =>
  prisma.barcodeReceiptItem.findMany({
    where: { purchaseOrderReceiptId: receiptId, branchId },
    include: {
      stockItem: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
          soldAt: true,
          productId: true,
          saleItems: { select: { id: true }, orderBy: { id: 'desc' }, take: 1 },
        },
      },
      receiptItem: {
        select: {
          purchaseOrderItem: { select: { productId: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

const findPurchaseOrderItems = (purchaseOrderId) =>
  prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: { id: true, productId: true, product: { select: { id: true, name: true } } },
  });

const findReceiptItems = (ids) =>
  prisma.purchaseOrderReceiptItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, purchaseOrderItemId: true },
  });

const findBarcodeStockLinks = (ids, branchId) =>
  prisma.barcodeReceiptItem.findMany({
    where: { id: { in: ids }, branchId, stockItemId: { not: null } },
    select: { id: true, stockItem: { select: { id: true, serialNumber: true } } },
  });

const findStockItemsByReceiptItem = (ids, branchId) =>
  prisma.stockItem.findMany({
    where: { branchId, purchaseOrderReceiptItemId: { in: ids } },
    select: { id: true, serialNumber: true, purchaseOrderReceiptItemId: true },
  });

module.exports = {
  findReceiptBarcodeCoverage,
  findPrintBatchRows,
  findProductsByIds,
  markReceiptPrinted,
  findReceiptsWaitingForPrint,
  searchReceiptsForReprint,
  findReceipt,
  findReprintItems,
  findPurchaseOrderItems,
  findReceiptItems,
  findBarcodeStockLinks,
  findStockItemsByReceiptItem,
};
