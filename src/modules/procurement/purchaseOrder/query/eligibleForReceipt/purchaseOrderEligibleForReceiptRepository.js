const { prisma } = require('../../../../../../lib/prisma')

const findEligiblePurchaseOrders = async ({ branchId, statuses }) => {
  return prisma.purchaseOrder.findMany({
    where: {
      branchId,
      status: { in: statuses },
    },
    select: {
      id: true,
      code: true,
      status: true,
      createdAt: true,
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

module.exports = {
  findEligiblePurchaseOrders,
}
