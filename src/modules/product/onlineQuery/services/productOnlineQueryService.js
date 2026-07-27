const { prisma } = require('../../../../lib/prisma')
const {
  findOperationalOnlineProductList,
  findOperationalOnlineProductDetailById,
} = require('../../runtime/repositories/operationalProductRuntimeRepository')
const {
  toOperationalProductOnlineSearchItem,
  toOperationalOnlineProductDetail,
} = require('../../runtime/mappers/operationalProductOnlineMapper')
const { normStr, toInt } = require('../../runtime/shared/operationalProductInput')

const requireBranchId = (branchId) => {
  const id = toInt(branchId)
  if (!id) {
    const error = new Error('BRANCH_REQUIRED')
    error.statusCode = 400
    error.code = 'BRANCH_REQUIRED'
    throw error
  }
  return id
}

const searchProductsForOnline = async ({ branchId, search = '', take = 50, size, page = 1, productTypeId, brandId, readyOnly = 'false', hasPrice = 'false', mode, simpleOnly, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const takeNum = Math.max(1, Math.min(toInt(size) ?? toInt(take) ?? 50, 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  const queryMode = String(mode || '').toUpperCase()
  const wantSimpleOnly = simpleOnly === '1' || simpleOnly === true || queryMode === 'SIMPLE'
  const whereAND = [{ productType: { branchId: brId } }]
  if (wantSimpleOnly) whereAND.push({ mode: 'SIMPLE' })
  const keyword = normStr(search)
  if (keyword) whereAND.push({ OR: [{ name: { contains: keyword, mode: 'insensitive' } }] })
  const typeId = toInt(productTypeId)
  const resolvedBrandId = toInt(brandId)
  if (typeId) whereAND.push({ productTypeId: typeId })
  if (resolvedBrandId) whereAND.push({ brandId: resolvedBrandId })
  const items = await findOperationalOnlineProductList({ branchId: brId, where: { AND: whereAND }, take: takeNum, skip: skipNum, db })
  let mapped = items.map(toOperationalProductOnlineSearchItem)
  if (String(readyOnly).toLowerCase() === 'true') mapped = mapped.filter((item) => item.isReady === true)
  if (String(hasPrice).toLowerCase() === 'true') mapped = mapped.filter((item) => item.hasPrice === true && item.branchPriceActive !== false)
  return mapped
}

const getProductForOnlineById = async ({ branchId, productId, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const id = toInt(productId)
  if (!id) { const error = new Error('INVALID_ID'); error.statusCode = 400; error.code = 'INVALID_ID'; throw error }
  const product = await findOperationalOnlineProductDetailById({ branchId: brId, productId: id, db })
  if (!product) { const error = new Error('NOT_FOUND'); error.statusCode = 404; error.code = 'NOT_FOUND'; throw error }
  return toOperationalOnlineProductDetail(product)
}

module.exports = { searchProductsForOnline, getProductForOnlineById }
