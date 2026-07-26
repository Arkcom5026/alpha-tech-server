const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../../../lib/prisma');
const { generateReceiptCode } = require('../../../../../utils/generateReceiptCode');

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

module.exports = { create };
