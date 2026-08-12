const dayjs = require('dayjs');
const { prisma } = require('../../../../../../lib/prisma');

const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

const getRequiredBarcodeCount = ({ mode, quantity }) => {
  if (String(mode || '').toUpperCase() === 'SIMPLE') return 1;
  const numericQuantity = toNumber(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return 0;
  return Math.ceil(numericQuantity);
};

const getMissingBarcodeCount = ({ mode, quantity, existingCount }) => {
  const required = getRequiredBarcodeCount({ mode, quantity });
  const existing = Math.max(0, Number(existingCount) || 0);
  return Math.max(0, required - existing);
};

const loadReceipt = ({ id, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id, branchId },
    include: {
      items: {
        include: {
          product: { select: { id: true, mode: true } },
          purchaseOrderItem: {
            select: { product: { select: { id: true, mode: true } } },
          },
        },
      },
    },
  });

const generate = async ({ receipt, branchId }) => {
  const yearMonth = dayjs().format('YYMM');

  return prisma.$transaction(async (tx) => {
    // This upsert intentionally performs a no-op update on conflict so concurrent
    // generation requests for the same branch/month serialize on the counter row
    // before existing barcode counts are inspected.
    await tx.barcodeCounter.upsert({
      where: { branchId_yearMonth: { branchId, yearMonth } },
      update: { lastNumber: { increment: 0 } },
      create: { branchId, yearMonth, lastNumber: 0 },
    });

    const created = [];
    for (const item of receipt.items) {
      const mode = item.product?.mode || item.purchaseOrderItem?.product?.mode || 'STRUCTURED';
      const kind = String(mode).toUpperCase() === 'SIMPLE' ? 'LOT' : 'SN';
      const existingCount = await tx.barcodeReceiptItem.count({
        where: {
          receiptItemId: item.id,
          branchId,
          kind,
          status: { not: 'VOID' },
        },
      });
      const missingCount = getMissingBarcodeCount({
        mode,
        quantity: item.quantity,
        existingCount,
      });

      for (let index = 0; index < missingCount; index += 1) {
        const counter = await tx.barcodeCounter.update({
          where: { branchId_yearMonth: { branchId, yearMonth } },
          data: { lastNumber: { increment: 1 } },
          select: { lastNumber: true },
        });
        const barcode = `${branchId}${yearMonth}${String(counter.lastNumber).padStart(6, '0')}`;
        created.push(await tx.barcodeReceiptItem.create({
          data: {
            barcode,
            yearMonth,
            runningNumber: counter.lastNumber,
            status: 'READY',
            kind,
            branchId,
            purchaseOrderReceiptId: receipt.id,
            receiptItemId: item.id,
          },
        }));
      }
    }
    return created;
  }, { timeout: 20000, maxWait: 8000 });
};

module.exports = {
  loadReceipt,
  generate,
  getRequiredBarcodeCount,
  getMissingBarcodeCount,
};
