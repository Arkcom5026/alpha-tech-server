'use strict';

const dayjs = require('dayjs');
const generateBarcodeRepository = require('./generateBarcodeRepository');

const buildGenerationPlan = (receipt) => {
  const plansSN = [];
  const plansLOT = [];

  for (const item of receipt.items) {
    const quantity = Number(item.quantity || 0);
    const existingSN = (item.barcodeReceiptItem || []).filter(
      (row) => row.kind === 'SN' || row.stockItemId
    ).length;
    const existingLOT = (item.barcodeReceiptItem || []).filter(
      (row) => row.kind === 'LOT' || row.simpleLotId
    ).length;
    const mode = item.purchaseOrderItem?.product?.mode || item.product?.mode || null;

    if (mode === 'STRUCTURED') {
      const missing = Math.max(0, quantity - existingSN);
      if (missing > 0) plansSN.push({ receiptItemId: item.id, count: missing });
    } else if (mode === 'SIMPLE') {
      const missing = existingLOT > 0 ? 0 : 1;
      if (missing > 0) plansLOT.push({ receiptItemId: item.id, count: 1 });
    }
  }

  return { SN: plansSN, LOT: plansLOT };
};

const generateMissingBarcodes = async ({ receiptId, branchId, dryRun, lotLabelPerLot }) =>
  generateBarcodeRepository.withTransaction(async (tx) => {
    const receipt = await generateBarcodeRepository.findReceiptForGeneration(tx, {
      receiptId,
      branchId,
    });

    if (!receipt) {
      const error = new Error('NOT_FOUND_RECEIPT');
      error.status = 404;
      throw error;
    }

    const plan = buildGenerationPlan(receipt);
    const totalToCreate =
      plan.SN.reduce((sum, item) => sum + item.count, 0) +
      plan.LOT.reduce((sum, item) => sum + item.count, 0);

    if (dryRun) {
      return { totalToCreate, plan };
    }

    if (totalToCreate === 0) {
      return { createdCount: 0, barcodes: [] };
    }

    const yearMonth = dayjs().format('YYMM');
    const counter = await generateBarcodeRepository.reserveCounterRange(tx, {
      branchId: receipt.branchId,
      yearMonth,
      totalToCreate,
    });

    if (counter.endNumber > 9999) {
      await generateBarcodeRepository.rollbackCounterRange(tx, {
        branchId: receipt.branchId,
        yearMonth,
        totalToCreate,
      });
      const error = new Error('COUNTER_OVERFLOW');
      error.status = 400;
      throw error;
    }

    const barcodes = [];
    let running = counter.startNumber;
    const append = (receiptItemId, kind) => {
      const padded = String(running).padStart(4, '0');
      barcodes.push({
        barcode: `${String(receipt.branchId)}${yearMonth}${padded}`,
        branchId: receipt.branchId,
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

    for (const item of plan.SN) {
      for (let index = 0; index < item.count; index += 1) append(item.receiptItemId, 'SN');
    }
    for (const item of plan.LOT) {
      const labels = Math.max(1, Number(lotLabelPerLot || 1));
      for (let index = 0; index < item.count; index += 1) append(item.receiptItemId, 'LOT');
      void labels;
    }

    await generateBarcodeRepository.createBarcodes(tx, barcodes);
    return { createdCount: barcodes.length, barcodes };
  });

module.exports = {
  buildGenerationPlan,
  generateMissingBarcodes,
};
