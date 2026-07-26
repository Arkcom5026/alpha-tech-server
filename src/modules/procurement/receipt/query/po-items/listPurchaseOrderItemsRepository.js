const { prisma } = require('../../../../../../lib/prisma');

const listByPurchaseOrder = async ({ poId, branchId }) => {
  return prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrderId: poId,
      purchaseOrder: { branchId },
    },
    include: {
      product: { select: { id: true, name: true, unit: true } },
    },
    orderBy: [{ id: 'asc' }],
  });
};

module.exports = { listByPurchaseOrder };
