const { prisma } = require('../../../../../lib/prisma')
const { Prisma } = require('@prisma/client')

const toDecimal = (value) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0)

const findPurchaseOrderForUpdate = ({ purchaseOrderId, branchId }) =>
  prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      branchId,
    },
    select: { id: true },
  })

const updatePurchaseOrderTransaction = async ({
  purchaseOrderId,
  branchId,
  note,
  status,
  items,
}) =>
  prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        note: note || null,
        status: status || undefined,
      },
    })

    if (Array.isArray(items)) {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId },
      })

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          items: {
            create: items.map((item) => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              costPrice: toDecimal(item.costPrice),
            })),
          },
        },
      })

      for (const item of items) {
        const productId = Number(item.productId)
        const costPrice = toDecimal(item.costPrice)

        await tx.branchPrice.upsert({
          where: {
            productId_branchId: {
              productId,
              branchId,
            },
          },
          update: { costPrice },
          create: {
            productId,
            branchId,
            costPrice,
            isActive: true,
          },
        })
      }
    }
  })

module.exports = {
  findPurchaseOrderForUpdate,
  updatePurchaseOrderTransaction,
}
