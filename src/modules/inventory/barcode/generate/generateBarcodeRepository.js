'use strict';

const { prisma } = require('../../../../../lib/prisma');

const withTransaction = (work) => prisma.$transaction(work, { timeout: 30000 });

const findReceiptForGeneration = (tx, { receiptId, branchId }) =>
  tx.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    include: {
      items: {
        include: {
          purchaseOrderItem: {
            select: {
              id: true,
              productId: true,
              product: { select: { id: true, mode: true } },
            },
          },
          product: { select: { id: true, mode: true } },
          barcodeReceiptItem: {
            select: { id: true, kind: true, stockItemId: true, simpleLotId: true },
          },
        },
      },
      purchaseOrder: { select: { id: true, code: true } },
    },
  });

const reserveCounterRange = async (tx, { branchId, yearMonth, totalToCreate }) => {
  await tx.barcodeCounter.upsert({
    where: { branchId_yearMonth: { branchId, yearMonth } },
    update: {},
    create: { branchId, yearMonth, lastNumber: 0 },
  });

  const counter = await tx.barcodeCounter.update({
    where: { branchId_yearMonth: { branchId, yearMonth } },
    data: { lastNumber: { increment: totalToCreate } },
  });

  return {
    endNumber: counter.lastNumber,
    startNumber: counter.lastNumber - totalToCreate + 1,
  };
};

const rollbackCounterRange = (tx, { branchId, yearMonth, totalToCreate }) =>
  tx.barcodeCounter.update({
    where: { branchId_yearMonth: { branchId, yearMonth } },
    data: { lastNumber: { decrement: totalToCreate } },
  });

const createBarcodes = async (tx, barcodes) => {
  if (barcodes.length === 0) return;
  await tx.barcodeReceiptItem.createMany({ data: barcodes, skipDuplicates: true });
};

module.exports = {
  withTransaction,
  findReceiptForGeneration,
  reserveCounterRange,
  rollbackCounterRange,
  createBarcodes,
};
