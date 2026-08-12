const {
  cloneOperationalProductFromTemplate,
} = require('../services/productTemplateCloneService')

const createOperationalProductFromTemplate = async (req, res) => {
  try {
    const result = await cloneOperationalProductFromTemplate({
      branchId: req.user?.branchId,
      templateProductId: req.body?.templateProductId,
      employeeId: req.employee?.id || req.user?.employeeId || null,
      role: req.user?.role,
      v2Role: req.employee?.role,
    })

    const status = result.statusCode || (result.created ? 201 : 200)
    const { statusCode, ...payload } = result

    return res.status(status).json(payload)
  } catch (error) {
    console.error('createOperationalProductFromTemplate error:', error)

    const code = error?.code || error?.message
    const status = Number(error?.status || error?.statusCode)

    if (Number.isInteger(status) && status >= 400 && status < 500) {
      return res.status(status).json({
        success: false,
        error: code || 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_REJECTED',
        ...(error?.details ? { details: error.details } : {}),
      })
    }

    return res.status(500).json({
      success: false,
      error: 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_FAILED',
    })
  }
}

module.exports = {
  createOperationalProductFromTemplate,
}
