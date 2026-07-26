const { prisma } = require('../../../../../lib/prisma');

const isLotRow = (row) => row?.kind === 'LOT' || row?.simpleLotId != null;

const findReceipt = ({ id, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id, branchId },
    select: { id: true, statusReceipt: true, purchaseOrderId: true },
  });

const getPendingCounts = async (receiptId, client = prisma) => {
  const rows = await client.barcodeReceiptItem.findMany({
    where: { receiptItem: { receiptId } },
    select: { id: true, kind: true, status: true, stockItemId: true, simpleLotId: true },
  });
  let pendingSN = 0;
  let pendingLOT = 0;
  for (const row of rows) {
    if (isLotRow(row)) {
      if ((row.status || null) !== 'SN_RECEIVED') pendingLOT += 1;
    } else if (row.stockItemId == null) {
      pendingSN += 1;
    }
  }
  return { pendingSN, pendingLOT, total: rows.length };
};

const computePoStatus = async (purchaseOrderId, client = prisma) => {
  const rows = await client.barcodeReceiptItem.findMany({
    where: { receiptItem: { receipt: { purchaseOrderId } } },
    select: { kind: true, status: true, stockItemId: true, simpleLotId: true },
  });
  if (rows.length === 0) return 'PENDING';
  const done = rows.filter((row) => isLotRow(row) ? row.status === 'SN_RECEIVED' : row.stockItemId != null).length;
  if (done === 0) return 'PENDING';
  if (done < rows.length) return 'PARTIALLY_RECEIVED';
  return 'COMPLETED';
};

const finalize = ({ id, purchaseOrderId }) =>
  prisma.$transaction(async (tx) => {
    await tx.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: 'COMPLETED' },
    });
    let poStatus = 'PENDING';
    try {
      poStatus = await computePoStatus(purchaseOrderId, tx);
      await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: poStatus } });
    } catch (error) {
      console.warn('[finalizeReceipt] purchaseOrder.status not updated:', error?.code || error?.message);
    }
    return { poStatus };
  });

module.exports = { findReceipt, getPendingCounts, computePoStatus, finalize };
