const { prisma } = require('../../../../../../lib/prisma')

const findPurchaseOrders = async ({ branchId, statuses, search, skip, take }) => {
  const where = {
    branchId,
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { supplier: { is: { name: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  }

  return prisma.purchaseOrder.findMany({
    where,
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
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  })
}

module.exports = {
  findPurchaseOrders,
}
