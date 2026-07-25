// src/modules/product/delete/services/productDeleteService.js

const repository = require('../repositories/productDeleteRepository')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const makeError = (code, status, payload = {}) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  Object.assign(error, payload)
  return error
}

const requireSuperadmin = (role) => {
  if (String(role || '').toUpperCase() !== 'SUPERADMIN') {
    throw makeError('FORBIDDEN', 403, { message: 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น' })
  }
}

const analyzeUsage = async ({ productId }) => {
  const counts = await repository.getUsageCounts({ productId })
  const values = Object.values(counts)
  const hasUnknown = values.some((value) => value === null)
  const hasUsage = values.some((value) => typeof value === 'number' && value > 0)
  return {
    counts,
    hasUnknown,
    hasUsage,
    canHardDelete: !hasUnknown && !hasUsage,
  }
}

const getDeleteCheck = async ({ productId, role } = {}) => {
  const id = toInt(productId)
  if (!id) throw makeError('INVALID_ID', 400)
  requireSuperadmin(role)

  const product = await repository.findProduct({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)

  const usage = await analyzeUsage({ productId: id })
  return {
    ok: true,
    product: {
      id: product.id,
      name: product.name,
      active: typeof product.active === 'boolean' ? product.active : true,
    },
    canHardDelete: usage.canHardDelete,
    reason: usage.canHardDelete
      ? 'NO_USAGE'
      : usage.hasUnknown
        ? 'USAGE_UNKNOWN'
        : 'USED_IN_SYSTEM',
    counts: usage.counts,
  }
}

const deleteProduct = async ({ productId, role } = {}) => {
  const id = toInt(productId)
  if (!id) throw makeError('INVALID_ID', 400)
  requireSuperadmin(role)

  const usage = await analyzeUsage({ productId: id })
  if (!usage.canHardDelete) {
    throw makeError('PRODUCT_IN_USE', 409, {
      reason: usage.hasUnknown ? 'USAGE_UNKNOWN' : 'USED_IN_SYSTEM',
      message: 'ไม่สามารถลบสินค้าได้ เพราะมีประวัติการใช้งาน/อ้างอิงอยู่แล้ว',
      counts: usage.counts,
    })
  }

  await repository.hardDeleteProduct({ productId: id })
  return { ok: true, success: true, id }
}

module.exports = {
  getDeleteCheck,
  deleteProduct,
}
