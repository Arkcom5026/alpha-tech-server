const { prisma } = require('../../../../../lib/prisma');
const dayjs = require('dayjs');

const generateMissingBarcodesForReceipt = async (receiptId, branchId, options = {}) => {
  const { dryRun = false, lotLabelPerLot = 1 } = options;

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseOrderReceipt.findFirst({
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

    if (!receipt) {
      const error = new Error('NOT_FOUND_RECEIPT');
      error.status = 404;
      throw error;
    }

    const yearMonth = dayjs().format('YYMM');
    const plansSN = [];
    const plansLOT = [];

    for (const item of receipt.items) {
      const quantity = Number(item.quantity || 0);
      const existingSN = (item.barcodeReceiptItem || []).filter(
        (entry) => entry.kind === 'SN' || entry.stockItemId
      ).length;
      const existingLOT = (item.barcodeReceiptItem || []).filter(
        (entry) => entry.kind === 'LOT' || entry.simpleLotId
      ).length;
      const mode = item.purchaseOrderItem?.product?.mode || item.product?.mode || null;

      if (mode === 'STRUCTURED') {
        const missing = Math.max(0, quantity - existingSN);
        if (missing > 0) plansSN.push({ receiptItemId: item.id, count: missing });
      } else if (mode === 'SIMPLE' && existingLOT === 0) {
        plansLOT.push({ receiptItemId: item.id, count: 1, lotLabelPerLot });
      }
    }

    const totalToCreate =
      plansSN.reduce((sum, plan) => sum + plan.count, 0) +
      plansLOT.reduce((sum, plan) => sum + plan.count, 0);

    if (dryRun) return { totalToCreate, plan: { SN: plansSN, LOT: plansLOT } };
    if (totalToCreate === 0) return { createdCount: 0, barcodes: [] };

    await tx.barcodeCounter.upsert({
      where: { branchId_yearMonth: { branchId, yearMonth } },
      update: {},
      create: { branchId, yearMonth, lastNumber: 0 },
    });

    const counter = await tx.barcodeCounter.update({
      where: { branchId_yearMonth: { branchId, yearMonth } },
      data: { lastNumber: { increment: totalToCreate } },
    });

    const endNumber = counter.lastNumber;
    const startNumber = endNumber - totalToCreate + 1;

    if (endNumber > 9999) {
      await tx.barcodeCounter.update({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        data: { lastNumber: { decrement: totalToCreate } },
      });
      const error = new Error('COUNTER_OVERFLOW');
      error.status = 400;
      throw error;
    }

    const barcodes = [];
    let running = startNumber;
    const appendBarcode = (receiptItemId, kind) => {
      barcodes.push({
        barcode: `${String(branchId)}${yearMonth}${String(running).padStart(4, '0')}`,
        branchId,
        yearMonth,
        runningNumber: running,
        status: 'READY',
        printed: false,
        kind,
        purchaseOrderReceiptId: receipt.id,
        receiptItemId,
      });
      running += 1;
    };

    for (const plan of plansSN) {
      for (let index = 0; index < plan.count; index += 1) appendBarcode(plan.receiptItemId, 'SN');
    }
    for (const plan of plansLOT) appendBarcode(plan.receiptItemId, 'LOT');

    await tx.barcodeReceiptItem.createMany({ data: barcodes, skipDuplicates: true });
    return { createdCount: barcodes.length, barcodes };
  }, { timeout: 30000 });
};

module.exports = { generateMissingBarcodesForReceipt };
