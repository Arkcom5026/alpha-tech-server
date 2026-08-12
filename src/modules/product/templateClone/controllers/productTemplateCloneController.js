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
    if (
      code === 'BRANCH_ID_MISSING' ||
      code === 'TEMPLATE_PRODUCT_ID_MISSING' ||
      code === 'TEMPLATE_BRANCH_NOT_FOUND' ||
      code === 'TEMPLATE_PRODUCT_NOT_FOUND' ||
      code === 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND' ||
      code === 'TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH'
    ) {
      return res.status(error?.status || error?.statusCode || 400).json({
        success: false,
        error: code,
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
