const { prisma } = require('../../../../../lib/prisma');

async function findReceipt(receiptId, branchId) {
  return prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true },
  });
}

async function findReceiptItems(receiptId) {
  return prisma.purchaseOrderReceiptItem.findMany({
    where: { purchaseOrderReceiptId: receiptId },
    select: { id: true, quantity: true },
  });
}

async function findBarcodeItems(receiptId, branchId) {
  return prisma.barcodeReceiptItem.findMany({
    where: { purchaseOrderReceiptId: receiptId, branchId },
    select: { id: true, barcode: true, receiptItemId: true, stockItemId: true, simpleLotId: true },
  });
}

async function findStockItems(branchId, receiptItemIds) {
  return prisma.stockItem.findMany({
    where: { branchId, purchaseOrderReceiptItemId: { in: receiptItemIds } },
    select: { id: true, purchaseOrderReceiptItemId: true },
  });
}

async function findSimpleLots(branchId, receiptItemIds) {
  return prisma.simpleLot.findMany({
    where: { branchId, receiptItemId: { in: receiptItemIds } },
    select: { id: true, receiptItemId: true },
  });
}

module.exports = {
  findReceipt,
  findReceiptItems,
  findBarcodeItems,
  findStockItems,
  findSimpleLots,
};
