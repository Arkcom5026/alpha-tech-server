// src/modules/product/migrateToSimple/services/productMigrateToSimpleService.js

const repository = require('../repositories/productMigrateToSimpleRepository')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const makeError = (code, status) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const migrateToSimple = async ({ productId, branchId } = {}) => {
  const id = toInt(productId)
  const brId = toInt(branchId)

  if (!id) throw makeError('INVALID_ID', 400)
  if (!brId) throw makeError('unauthorized', 401)

  const product = await repository.findProduct({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)
  if (product.mode === 'SIMPLE') throw makeError('ALREADY_SIMPLE', 409)

  const groups = await repository.groupInStockItemsByBranch({ productId: id })
  let migratedQty = 0

  await repository.prisma.$transaction(async (tx) => {
    for (const group of groups) {
      const quantity = Number(group._count?._all ?? 0)
      if (!quantity) continue

      migratedQty += quantity
      await repository.upsertStockBalance({
        db: tx,
        productId: id,
        branchId: group.branchId,
        quantity,
      })
      await repository.markStockItemsUsed({
        db: tx,
        productId: id,
        branchId: group.branchId,
      })
    }

    await repository.setProductSimple({ db: tx, productId: id })
  })

  return {
    success: true,
    migratedQty,
    branches: groups.length,
  }
}

module.exports = { migrateToSimple }
