const { prisma } = require('../../../../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const getProductExistingModelPreview = async ({ productTypeId, brandId, take } = {}) => {
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  const takeNum = Math.max(1, Math.min(toInt(take) ?? 80, 200))

  if (!ptId || !brId) {
    return { items: [], total: 0 }
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      productTypeId: ptId,
      brandId: brId,
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
