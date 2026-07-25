// src/modules/product/status/services/productStatusService.js

const repository = require('../repositories/productStatusRepository')

const makeError = (code, status, message = code) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const requireSuperadmin = (role) => {
  if (String(role || '').toUpperCase() !== 'SUPERADMIN') {
    throw makeError('FORBIDDEN', 403, 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น')
  }
}

const disableProduct = async () => {
  throw makeError(
    'FEATURE_DISABLED',
    403,
    'Product เป็นข้อมูลกลาง ไม่อนุญาตให้ปิดใช้งาน'
  )
}

const enableProduct = async () => {
  throw makeError(
    'FEATURE_DISABLED',
    403,
    'Product เป็นข้อมูลกลาง ไม่อนุญาตให้เปิดใช้งาน'
  )
}

const archiveProduct = async ({ productId, role } = {}) => {
  const id = toInt(productId)
  if (!id) throw makeError('INVALID_ID', 400)

  requireSuperadmin(role)

  const current = await repository.findProductById({ productId: id })
  if (!current) throw makeError('NOT_FOUND', 404)

  return repository.archiveProduct({ productId: id })
}

module.exports = {
  disableProduct,
  enableProduct,
  archiveProduct,
}
