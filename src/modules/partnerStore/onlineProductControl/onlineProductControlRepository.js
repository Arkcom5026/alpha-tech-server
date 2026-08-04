'use strict'

const { prisma } = require('../../../../lib/prisma')

const findOwnedPrice = ({ branchId, productId, db = prisma }) => db.branchPrice.findFirst({
  where: { branchId, productId },
  select: {
    id: true,
    branchId: true,
    productId: true,
    priceOnline: true,
    effectiveDate: true,
    expiredDate: true,
    isActive: true,
  },
})

const updateOwnedPrice = ({ branchId, productId, data, db = prisma }) => db.branchPrice.update({
  where: { productId_branchId: { productId, branchId } },
  data,
  select: {
    id: true,
    branchId: true,
    productId: true,
    priceOnline: true,
    effectiveDate: true,
    expiredDate: true,
    isActive: true,
    updatedAt: true,
  },
})

module.exports = Object.freeze({ findOwnedPrice, updateOwnedPrice })
