const { Prisma } = require('@prisma/client')
const { prisma } = require('../../../../../lib/prisma')

const toDecimal = (value) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)

const findLatestPurchaseOrderCode = async ({ branchId, prefix }) =>
  prisma.purchaseOrder.findFirst({
    where: {
      branchId,
      code: { startsWith: prefix },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

const createPurchaseOrderTransaction = async ({
  code,
  branchId,
  employeeId,
  supplierId,
  note,
  items,
}) =>
  prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        code,
        ...(supplierId
          ? { supplier: { connect: { id: supplierId } } }
          : {}),
        branch: { connect: { id: branchId } },
        employee: { connect: { id: employeeId } },
        note,
        status: 'PENDING',
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            costPrice: toDecimal(item.costPrice),
          })),
        },
      },
    })

    for (const item of items) {
      const costPrice = toDecimal(item.costPrice)

      await tx.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId,
          },
        },
        update: { costPrice },
        create: {
          productId: item.productId,
          branchId,
          costPrice,
          isActive: true,
        },
      })
    }

    return purchaseOrder
  })

module.exports = {
  findLatestPurchaseOrderCode,
  createPurchaseOrderTransaction,
}
