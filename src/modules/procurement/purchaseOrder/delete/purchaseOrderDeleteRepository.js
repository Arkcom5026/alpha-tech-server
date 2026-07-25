const { prisma } = require('../../../../../lib/prisma')

const findPurchaseOrderForDelete = ({ purchaseOrderId, branchId }) =>
  prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      branchId,
    },
  })

const deletePurchaseOrderById = ({ purchaseOrderId }) =>
  prisma.purchaseOrder.delete({
    where: { id: purchaseOrderId },
  })

module.exports = {
  findPurchaseOrderForDelete,
  deletePurchaseOrderById,
}
