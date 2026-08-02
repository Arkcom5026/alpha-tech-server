const { Prisma } = require('../../../../../lib/prisma')
const { updateOperationalProduct } = require('../services/productMaintenanceService')

const getActor = (req) => ({
  branchId: req.employee?.branchId || req.user?.branchId || req.branchId,
  employeeId: req.employee?.id || req.user?.employeeId || null,
  role: req.employee?.role || req.employee?.v2Role || req.user?.role || req.user?.v2Role,
  v2Role: req.employee?.v2Role || req.user?.v2Role,
})

const updateProduct = async (req, res) => {
  try {
    const result = await updateOperationalProduct({
      productId: req.params.id,
      actor: getActor(req),
      data: req.body || {},
    })

    return res.json(result)
  } catch (error) {
    console.error('❌ updateProduct error:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_CONSTRAINT' })
      if (error.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' })
    }

    const status = error?.status || error?.statusCode
    if (status) {
      return res.status(status).json({
        error: error.code || error.message || 'ERROR',
        code: error.code || error.message || 'ERROR',
        message: error.message || error.code || 'ERROR',
        detail: error.detail,
      })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { updateProduct }
