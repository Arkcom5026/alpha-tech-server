const { prisma } = require('../../../../../../lib/prisma')

const findPurchaseOrdersBySupplier = async ({ branchId, supplierId }) => {
  return prisma.purchaseOrder.findMany({
    where: { branchId, supplierId },
    include: {
      supplier: true,
      items: {
        include: {
          product: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

module.exports = {
  findPurchaseOrdersBySupplier,
}
