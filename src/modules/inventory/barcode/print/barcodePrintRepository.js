'use strict';

const { prisma } = require('../../../../../lib/prisma');

const findExistingReceiptIds = ({ branchId, receiptIds }) =>
  prisma.barcodeReceiptItem.findMany({
    where: { branchId, purchaseOrderReceiptId: { in: receiptIds } },
    select: { purchaseOrderReceiptId: true },
    distinct: ['purchaseOrderReceiptId'],
  });

const findPrintBatchRows = ({ branchId, receiptIds }) =>
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

const findProductsByIds = (productIds) =>
  prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });

const findPendingPrintReceipts = ({ branchId }) =>
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

const searchReceiptsForReprint = ({ where, limit }) =>
  prisma.purchaseOrderReceipt.findMany({
    where,
    include: {
      purchaseOrder: {
        select: { code: true, supplier: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

const markPrinted = ({ branchId, receiptId }) =>
  prisma.$transaction([
    prisma.barcodeReceiptItem.updateMany({
      where: { branchId, purchaseOrderReceiptId: receiptId, printed: false },
      data: { printed: true },
    }),
    prisma.purchaseOrderReceipt.updateMany({
      where: { id: receiptId, branchId },
      data: { printed: true },
    }),
  ]);

const findReceipt = ({ branchId, receiptId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true, purchaseOrderId: true },
  });

const findReprintRows = ({ branchId, receiptId }) =>
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

const findReceiptItems = (receiptItemIds) =>
  prisma.purchaseOrderReceiptItem.findMany({
    where: { id: { in: receiptItemIds } },
    select: { id: true, purchaseOrderItemId: true },
  });

const findFallbackStockItems = ({ branchId, receiptItemIds }) =>
  prisma.stockItem.findMany({
    where: { branchId, purchaseOrderReceiptItemId: { in: receiptItemIds } },
    select: { id: true, serialNumber: true, purchaseOrderReceiptItemId: true },
  });

module.exports = {
  findExistingReceiptIds,
  findPrintBatchRows,
  findProductsByIds,
  findPendingPrintReceipts,
  searchReceiptsForReprint,
  markPrinted,
  findReceipt,
  findReprintRows,
  findPurchaseOrderItems,
  findReceiptItems,
  findFallbackStockItems,
};
