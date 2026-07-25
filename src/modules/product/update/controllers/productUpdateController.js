// src/modules/product/update/controllers/productUpdateController.js

const { Prisma } = require('../../../../../lib/prisma')
const productUpdateService = require('../services/productUpdateService')

const updateProduct = async (req, res) => {
  try {
    const result = await productUpdateService.updateProduct({
      productId: req.params.id,
      branchId: req.user?.branchId,
      data: req.body || {},
    })

    return res.json(result)
  } catch (error) {
    console.error('❌ productUpdate runtime error:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_CONSTRAINT' })
      if (error.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' })
    }

    if (error?.status) {
      return res.status(error.status).json({ error: error.code || error.message || 'ERROR' })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { updateProduct }
