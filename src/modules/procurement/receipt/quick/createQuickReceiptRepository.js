const { Prisma } = require('@prisma/client');
const dayjs = require('dayjs');
const { prisma } = require('../../../../../lib/prisma');

const generateReceiptCode = async (branchId, client) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const prefix = `RC-${paddedBranch}${dayjs().format('YYMM')}`;
  const latest = await client.purchaseOrderReceipt.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastSequence = latest?.code
    ? Number.parseInt(latest.code.split('-').pop(), 10)
    : 0;
  const nextSequence = (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1;
  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

const create = async ({ branchId, receivedById, note, supplierId, items }) => {
  return prisma.$transaction(async (tx) => {
    const code = await generateReceiptCode(branchId, tx);

    return tx.purchaseOrderReceipt.create({
      data: {
        code,
        note: note || null,
        receivedBy: { connect: { id: receivedById } },
        branch: { connect: { id: branchId } },
        supplier: supplierId ? { connect: { id: Number(supplierId) } } : undefined,
        source: 'QUICK',
        items: {
          create: items.map((item) => ({
            product: { connect: { id: Number(item.productId) } },
            quantity: new Prisma.Decimal(String(item.quantity)),
            costPrice: new Prisma.Decimal(String(item.costPrice)),
          })),
        },
      },
      include: {
        items: { select: { id: true, productId: true, quantity: true, costPrice: true } },
      },
    });
  }, { timeout: 20000, maxWait: 8000 });
};

module.exports = { create, generateReceiptCode };
