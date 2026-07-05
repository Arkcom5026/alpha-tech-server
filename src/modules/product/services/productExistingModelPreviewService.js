const { prisma } = require('../../../../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const getProductExistingModelPreview = async ({ branchId, productTypeId, brandId, take } = {}) => {
  const bId = toInt(branchId)
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  const takeNum = Math.max(1, Math.min(toInt(take) ?? 80, 200))

  if (!bId) {
    const error = new Error('BRANCH_ID_REQUIRED')
    error.status = 403
    error.code = 'BRANCH_ID_REQUIRED'
    throw error
  }

  if (!ptId || !brId) {
    return { items: [], total: 0 }
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      productTypeId: ptId,
      brandId: brId,
      branchPrice: {
        some: {
          branchId: bId,
          isActive: true,
        },
      },
    },

    select: {
      id: true,
      name: true,
    },
    orderBy: [
      { name: 'asc' },
      { id: 'asc' },
    ],
    take: takeNum,
  })

  const items = products
    .map((product) => ({
      id: Number(product.id),
      name: String(product.name ?? '').trim(),
    }))
    .filter((product) => product.name)

  return { items, total: items.length }
}

module.exports = {
  getProductExistingModelPreview,
}
