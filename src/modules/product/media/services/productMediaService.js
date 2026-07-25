const repository = require('../repositories/productMediaRepository')

let cloudinary = null
try {
  cloudinary = require('../../../../../lib/cloudinary')
} catch (_error) {
  cloudinary = null
}

const makeError = (code, status = 400) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const deleteProductImage = async ({ productId, branchId, publicId } = {}) => {
  const id = repository.toInt(productId)
  const brId = repository.toInt(branchId)

  if (!brId) throw makeError('unauthorized', 401)
  if (!id || !publicId) throw makeError('INVALID_PARAMS', 400)

  const product = await repository.findBranchScopedProduct({
    productId: id,
    branchId: brId,
  })

  if (!product) throw makeError('NOT_FOUND', 404)

  if (cloudinary?.uploader?.destroy) {
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (_error) {
      // Preserve legacy behavior: external media deletion is best-effort.
    }
  }

  await repository.deactivateProductImageByPublicId({
    productId: id,
    publicId,
  })

  return { success: true }
}

module.exports = {
  deleteProductImage,
}
