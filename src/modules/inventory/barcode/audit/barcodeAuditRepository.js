'use strict';

const { prisma } = require('../../../../../lib/prisma');

const findReceipt = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true },
  });

const findReceiptItems = ({ receiptId }) =>
  prisma.purchaseOrderReceiptItem.findMany({
    where: { purchaseOrderReceiptId: receiptId },
    select: { id: true, quantity: true },
  });

const findBarcodeRows = ({ receiptId, branchId }) =>
  prisma.barcodeReceiptItem.findMany({
    where: { purchaseOrderReceiptId: receiptId, branchId },
    select: {
      id: true,
      barcode: true,
      receiptItemId: true,
      stockItemId: true,
      simpleLotId: true,
    },
  });

const findStockItems = ({ branchId, receiptItemIds }) =>
  prisma.stockItem.findMany({
    where: { branchId, purchaseOrderReceiptItemId: { in: receiptItemIds } },
    select: { id: true, purchaseOrderReceiptItemId: true },
  });

const findSimpleLots = ({ branchId, receiptItemIds }) =>
  prisma.simpleLot.findMany({
    where: { branchId, receiptItemId: { in: receiptItemIds } },
    select: { id: true, receiptItemId: true },
  });

module.exports = {
  findReceipt,
  findReceiptItems,
  findBarcodeRows,
  findStockItems,
  findSimpleLots,
};
