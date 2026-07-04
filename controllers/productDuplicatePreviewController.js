const { prisma } = require('../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const getProductDuplicatePreview = async (req, res) => {
  try {
    const productTypeId = toInt(req.query?.productTypeId)
    const brandId = toInt(req.query?.brandId)
    const take = Math.max(1, Math.min(toInt(req.query?.take) ?? 80, 200))

    if (!productTypeId || !brandId) {
      res.set('Cache-Control', 'no-store')
      return res.json({ items: [], total: 0 })
    }

    const where = {
      active: true,
      productTypeId,
      brandId,
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: [
        { name: 'asc' },
        { id: 'asc' },
      ],
      take,
    })

    const items = products
      .map((product) => ({
        id: Number(product.id),
        name: String(product.name ?? '').trim(),
      }))
      .filter((product) => product.name)

    res.set('Cache-Control', 'no-store')
    return res.json({ items, total: items.length })
  } catch (error) {
    console.error('❌ getProductDuplicatePreview error:', error)
    return res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCT_DUPLICATE_PREVIEW' })
  }
}

module.exports = {
  getProductDuplicatePreview,
}
