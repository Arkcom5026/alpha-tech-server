'use strict';

const { prisma } = require('../../../../../lib/prisma');

const findAnyBarcode = ({ receiptId, branchId }) =>
  prisma.barcodeReceiptItem.findFirst({
    where: { purchaseOrderReceiptId: receiptId, branchId },
    select: { id: true },
  });

const findReceiptBarcodes = ({ receiptId, branchId, kind, onlyUnscanned, onlyUnactivated }) =>
  prisma.barcodeReceiptItem.findMany({
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

const findProductsByIds = (productIds) =>
  prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });

const findFallbackStockItems = ({ branchId, receiptItemIds }) =>
  prisma.stockItem.findMany({
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

module.exports = {
  findAnyBarcode,
  findReceiptBarcodes,
  findProductsByIds,
  findFallbackStockItems,
};
