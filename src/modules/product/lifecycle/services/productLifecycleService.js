const repository = require('../repositories/productLifecycleRepository')

const makeError = (code, status, message = code, details = null) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  if (details) error.details = details
  return error
}

const toProductId = (value) => {
  const id = Number.parseInt(value, 10)
  if (!Number.isFinite(id) || id <= 0) throw makeError('INVALID_ID', 400)
  return id
}

const requireSuperadmin = (role) => {
  if (String(role || '').trim().toUpperCase() !== 'SUPERADMIN') {
    throw makeError('FORBIDDEN', 403, 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น')
  }
}

const getUsage = async (productId) => {
  const counts = await repository.getProductUsageCounts({ productId })
  const hasUnknown = Object.values(counts).some((value) => value === null)
  const hasUsage = Object.values(counts).some((value) => typeof value === 'number' && value > 0)

  return {
    counts,
    hasUnknown,
    hasUsage,
    canHardDelete: !hasUnknown && !hasUsage,
  }
}

const refuseActivationChange = () => {
  throw makeError(
    'FEATURE_DISABLED',
    403,
    'Product เป็นข้อมูลกลาง ไม่อนุญาตให้เปลี่ยนสถานะผ่าน endpoint นี้'
  )
}

const getDeleteCheck = async ({ productId, role } = {}) => {
  const id = toProductId(productId)
  requireSuperadmin(role)

  const product = await repository.findProductSummaryById({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)

  const usage = await getUsage(id)
  const reason = usage.canHardDelete
    ? 'NO_USAGE'
    : usage.hasUnknown
      ? 'USAGE_UNKNOWN'
      : 'USED_IN_SYSTEM'

  return {
    ok: true,
    product: {
      id: product.id,
      name: product.name,
      active: typeof product.active === 'boolean' ? product.active : true,
    },
    canHardDelete: usage.canHardDelete,
    reason,
    counts: usage.counts,
  }
}

const archiveProduct = async ({ productId, role } = {}) => {
  const id = toProductId(productId)
  requireSuperadmin(role)

  const product = await repository.findProductSummaryById({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)

  const updated = await repository.setProductActive({ productId: id, active: false })
  return { ok: true, success: true, product: updated }
}

const hardDeleteProduct = async ({ productId, role } = {}) => {
  const id = toProductId(productId)
  requireSuperadmin(role)

  const product = await repository.findProductSummaryById({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)

  const usage = await getUsage(id)
  if (!usage.canHardDelete) {
    throw makeError(
      'PRODUCT_IN_USE',
      409,
      'ไม่สามารถลบสินค้าได้ เพราะมีประวัติการใช้งาน/อ้างอิงอยู่แล้ว',
      {
        reason: usage.hasUnknown ? 'USAGE_UNKNOWN' : 'USED_IN_SYSTEM',
        counts: usage.counts,
      }
    )
  }

  await repository.hardDeleteProduct({ productId: id })
  return { ok: true, success: true, id }
}

module.exports = {
  refuseActivationChange,
  getDeleteCheck,
  archiveProduct,
  hardDeleteProduct,
}
