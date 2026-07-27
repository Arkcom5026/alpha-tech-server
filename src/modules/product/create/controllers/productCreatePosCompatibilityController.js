const {
  createLocalOperationalProductForLegacyRuntime,
} = require('../services/productCreateCompatibilityService')

const createLocalOperationalProduct = async (req, res) => {
  try {
    const result = await createLocalOperationalProductForLegacyRuntime({
      branchId: req.user?.branchId,
      employeeId: req.employee?.id || req.user?.employeeId || null,
      data: req.body || {},
    })

    return res.status(201).json(result)
  } catch (error) {
    console.error('createLocalOperationalProduct error:', error)
    const status = error?.status || error?.statusCode || 500
    return res.status(status).json({
      success: false,
      error: error?.code || error?.message || 'CREATE_LOCAL_OPERATIONAL_PRODUCT_FAILED',
    })
  }
}

module.exports = {
  createLocalOperationalProduct,
}
