const { prisma } = require('../../../../../../lib/prisma');

const list = async ({ branchId, printed }) => {
  return prisma.purchaseOrderReceipt.findMany({
    where: { branchId, printed },
    select: {
      id: true,
      code: true,
      supplierTaxInvoiceNumber: true,
      statusReceipt: true,
      receivedAt: true,
      printed: true,
      items: {
        select: {
          quantity: true,
          stockItems: { select: { id: true } },
        },
      },
      purchaseOrder: {
        select: {
          code: true,
          supplier: { select: { name: true } },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
  });
};

module.exports = { list };
