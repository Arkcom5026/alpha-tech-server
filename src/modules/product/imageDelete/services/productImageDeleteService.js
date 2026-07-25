// src/modules/product/imageDelete/services/productImageDeleteService.js

const repository = require('../repositories/productImageDeleteRepository')

let cloudinary = null
try {
  cloudinary = require('../../../../../lib/cloudinary')
} catch (_error) {
  cloudinary = null
}

const makeError = (code, status) => {
  const error = new Error(code)
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

const deleteProductImage = async ({ productId, branchId, publicId } = {}) => {
  const id = toInt(productId)
  const brId = toInt(branchId)
  const normalizedPublicId = String(publicId || '').trim()

  if (!brId) throw makeError('unauthorized', 401)
  if (!id || !normalizedPublicId) throw makeError('INVALID_PARAMS', 400)

  const product = await repository.findBranchProduct({ productId: id, branchId: brId })
  if (!product) throw makeError('NOT_FOUND', 404)

  if (cloudinary?.uploader?.destroy) {
    try {
      await cloudinary.uploader.destroy(normalizedPublicId)
    } catch (_error) {
      // Preserve legacy behavior: external cleanup failure is non-fatal.
    }
  }

  await repository.deactivateProductImage({
    productId: id,
    publicId: normalizedPublicId,
  })

  return { success: true }
}

module.exports = { deleteProductImage }
