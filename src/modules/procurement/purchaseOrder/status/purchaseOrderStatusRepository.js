const { prisma } = require('../../../../../lib/prisma')

const findPurchaseOrderForStatus = ({ purchaseOrderId, branchId }) =>
  prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      branchId,
    },
    select: { id: true },
  })

const updatePurchaseOrderStatus = ({ purchaseOrderId, status }) =>
  prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status },
    include: {
      supplier: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true },
          },
        },
      },
    },
  })

module.exports = {
  findPurchaseOrderForStatus,
  updatePurchaseOrderStatus,
}
