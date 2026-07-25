const productCreateService = require('../services/productCreateService')

const getBranchId = (req) => Number(req.user?.branchId) || null
const getEmployeeId = (req) => Number(req.user?.employeeId) || Number(req.employee?.id) || null

const pickBranchPrice = (data = {}) => {
  if (data.branchPrice && typeof data.branchPrice === 'object') return data.branchPrice

  return {
    costPrice: data.costPrice,
    priceWholesale: data.priceWholesale,
    priceTechnician: data.priceTechnician,
    priceRetail: data.priceRetail,
    priceOnline: data.priceOnline,
    isActive: data.branchPriceActive ?? data.isActive,
  }
}

const createProduct = async (req, res) => {
  try {
    const branchId = getBranchId(req)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const data = req.body || {}
    const result = await productCreateService.createLocalOperationalProduct({
      branchId,
      employeeId: getEmployeeId(req),
      data: {
        ...data,
        branchPrice: pickBranchPrice(data),
      },
    })

    return res.status(201).json({ id: result.product.id })
  } catch (error) {
    const status = error?.status || error?.statusCode || 500
    const code = error?.code || 'FAILED_TO_CREATE_PRODUCT'

    if (status >= 500) console.error('❌ createProduct compatibility error:', error)
    return res.status(status).json({ error: code })
  }
}

module.exports = {
  createProduct,
}
