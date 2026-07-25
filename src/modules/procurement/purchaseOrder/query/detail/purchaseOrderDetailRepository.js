const { prisma } = require('../../../../../../lib/prisma')

const findPurchaseOrderDetail = ({ branchId, purchaseOrderId }) =>
  prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      branchId,
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productType: {
                select: {
                  name: true,
                  globalProductType: {
                    select: {
                      category: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
              brand: { select: { name: true } },
              templateProduct: {
                select: {
                  name: true,
                  unit: { select: { name: true } },
                },
              },
              unit: { select: { name: true } },
            },
          },
          receipts: { select: { id: true, quantity: true } },
        },
      },
    },
  })

module.exports = {
  findPurchaseOrderDetail,
}
