const { prisma } = require('../../../../../lib/prisma');

async function findAnyBarcode(receiptId, branchId) {
  return prisma.barcodeReceiptItem.findFirst({
    where: { purchaseOrderReceiptId: receiptId, branchId },
    select: { id: true },
  });
}

async function findBarcodeRows({ receiptId, branchId, kind, onlyUnscanned, onlyUnactivated }) {
  return prisma.barcodeReceiptItem.findMany({
    where: {
      purchaseOrderReceiptId: receiptId,
      branchId,
      ...(kind ? { kind } : {}),
      ...(onlyUnscanned ? { stockItemId: null } : {}),
      ...(onlyUnactivated && kind === 'LOT' ? { status: { not: 'SN_RECEIVED' } } : {}),
    },
    include: {
      stockItem: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
          soldAt: true,
          saleItems: { select: { id: true }, orderBy: { id: 'desc' }, take: 1 },
          productId: true,
        },
      },
      receiptItem: {
        select: {
          id: true,
          quantity: true,
          purchaseOrderItemId: true,
          purchaseOrderItem: { select: { id: true, productId: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
}

async function findProducts(productIds) {
  if (!productIds.length) return [];
  return prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
}

async function findStockItemsByReceiptItemIds(branchId, receiptItemIds) {
  if (!receiptItemIds.length) return [];
  return prisma.stockItem.findMany({
    where: { branchId, purchaseOrderReceiptItemId: { in: receiptItemIds } },
    select: {
      id: true,
      serialNumber: true,
      status: true,
      soldAt: true,
      saleItems: { select: { id: true }, orderBy: { id: 'desc' }, take: 1 },
      purchaseOrderReceiptItemId: true,
      productId: true,
    },
  });
}

module.exports = {
  findAnyBarcode,
  findBarcodeRows,
  findProducts,
  findStockItemsByReceiptItemIds,
};
