const dayjs = require('dayjs');
const { prisma } = require('../../../../../../lib/prisma');

const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

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
    await tx.barcodeCounter.upsert({
      where: { branchId_yearMonth: { branchId, yearMonth } },
      update: {},
      create: { branchId, yearMonth, lastNumber: 0 },
    });

    const created = [];
    for (const item of receipt.items) {
      const mode = item.product?.mode || item.purchaseOrderItem?.product?.mode || 'STRUCTURED';
      const amount = mode === 'SIMPLE' ? 1 : toNumber(item.quantity);
      const kind = mode === 'SIMPLE' ? 'LOT' : 'SN';

      for (let index = 0; index < amount; index += 1) {
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

module.exports = { loadReceipt, generate };
