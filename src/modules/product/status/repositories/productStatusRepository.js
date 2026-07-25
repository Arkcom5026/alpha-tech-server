// src/modules/product/status/repositories/productStatusRepository.js

const { prisma } = require('../../../../../lib/prisma')

const findProductById = ({ db = prisma, productId }) =>
  db.product.findUnique({
    where: { id: Number(productId) },
    select: { id: true, name: true, active: true },
  })

const archiveProduct = ({ db = prisma, productId }) =>
  db.product.update({
    where: { id: Number(productId) },
    data: { active: false },
    select: { id: true, name: true, active: true },
  })

module.exports = {
  prisma,
  findProductById,
  archiveProduct,
}
