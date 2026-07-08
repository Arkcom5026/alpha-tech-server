// src/modules/product/create/controllers/productCreateController.js

const productCreateService = require('../services/productCreateService')

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  const v = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(v)
}

const getBranchId = (req) =>
  req.employee?.branchId ||
  req.user?.branchId ||
  req.branchId

const getEmployeeId = (req) =>
  req.employee?.id ||
  req.user?.employeeId ||
  req.user?.activeProfileId ||
  req.user?.id

const sendError = (res, error, fallback = 'PRODUCT_CREATE_RUNTIME_ERROR') => {
  const status = error?.status || error?.statusCode || 500
  if (status >= 500) console.error('❌ productCreate runtime error:', error)

  return res.status(status).json({
    success: false,
    error: error?.code || fallback,
    code: error?.code || fallback,
    message: error?.message || fallback,
  })
}

const getDropdowns = async (req, res) => {
  try {
    const result = await productCreateService.getDropdowns({
      branchId: getBranchId(req),
      productTypeId: req.query?.productTypeId,
      includeInactive: toBool(req.query?.includeInactive),
    })
    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_LOAD_PRODUCT_CREATE_DROPDOWNS')
  }
}

const getBrands = async (req, res) => {
  try {
    const result = await productCreateService.getBrands({
      branchId: getBranchId(req),
      productTypeId: req.query?.productTypeId,
      includeInactive: toBool(req.query?.includeInactive),
    })
    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_LOAD_PRODUCT_CREATE_BRANDS')
  }
}

const getExistingModels = async (req, res) => {
  try {
    const result = await productCreateService.getExistingModels({
      branchId: req.query?.targetBranchId || getBranchId(req),
      productTypeId: req.query?.productTypeId,
      brandId: req.query?.brandId,
      search: req.query?.q || req.query?.search,
      limit: req.query?.limit || req.query?.take,
    })
    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_LOAD_PRODUCT_CREATE_EXISTING_MODELS')
  }
}

const createLocalProduct = async (req, res) => {
  try {
    const result = await productCreateService.createLocalOperationalProduct({
      branchId: getBranchId(req),
      employeeId: getEmployeeId(req),
      data: req.body || {},
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_CREATE_LOCAL_PRODUCT')
  }
}

module.exports = {
  getDropdowns,
  getBrands,
  getExistingModels,
  createLocalProduct,
}
