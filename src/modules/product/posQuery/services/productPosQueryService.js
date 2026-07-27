const { prisma } = require('../../../../lib/prisma')
const {
  findOperationalProductDetailById,
  findOperationalProductList,
} = require('../../runtime/repositories/operationalProductRuntimeRepository')
const { toOperationalProductPosSearchItem } = require('../../runtime/mappers/operationalProductPosSearchMapper')
const { toOperationalProductDetail } = require('../../runtime/mappers/operationalProductDetailMapper')
const { normStr, toInt } = require('../../runtime/shared/operationalProductInput')

const requireBranchId = (branchId) => {
  const id = toInt(branchId)
  if (!id) {
    const error = new Error('unauthorized')
    error.statusCode = 401
    error.code = 'unauthorized'
    throw error
  }
  return id
}

const searchProductsForPos = async ({ branchId, search = '', take = 50, page = 1, productTypeId, brandId, readyOnly = 'false', hasPrice = 'false', activeOnly = 'true', includeInactive = '0', mode, simpleOnly, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const takeNum = Math.max(1, Math.min(toInt(take) ?? 50, 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  const queryMode = String(mode || '').toUpperCase()
  const wantSimpleOnly = simpleOnly === '1' || simpleOnly === true || queryMode === 'SIMPLE'
  const wantIncludeInactive = String(includeInactive) === '1' || String(includeInactive).toLowerCase() === 'true'
  const wantActiveOnlyFalse = String(activeOnly).toLowerCase() === 'false'
  const activeFilter = wantIncludeInactive || wantActiveOnlyFalse ? undefined : true
  const whereAND = [{ productType: { branchId: brId } }]
  if (wantSimpleOnly) whereAND.push({ mode: 'SIMPLE' })
  if (activeFilter !== undefined) whereAND.push({ active: activeFilter })
  const keyword = normStr(search)
  if (keyword) whereAND.push({ OR: [{ name: { contains: keyword, mode: 'insensitive' } }] })
  const typeId = toInt(productTypeId)
  const resolvedBrandId = toInt(brandId)
  if (typeId) whereAND.push({ productTypeId: typeId })
  if (resolvedBrandId) whereAND.push({ brandId: resolvedBrandId })
  const items = await findOperationalProductList({ branchId: brId, where: { AND: whereAND }, take: takeNum, skip: skipNum, db })
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()]
  let mapped = uniqueItems.map(toOperationalProductPosSearchItem)
  if (String(readyOnly).toLowerCase() === 'true') mapped = mapped.filter((item) => item.isReady)
  if (String(hasPrice).toLowerCase() === 'true') mapped = mapped.filter((item) => item.hasPrice && item.branchPriceActive !== false)
  return mapped
}

const getProductForPosById = async ({ branchId, productId, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const id = toInt(productId)
  if (!id) { const error = new Error('INVALID_ID'); error.statusCode = 400; error.code = 'INVALID_ID'; throw error }
  const product = await findOperationalProductDetailById({ branchId: brId, productId: id, db })
  if (!product) { const error = new Error('NOT_FOUND'); error.statusCode = 404; error.code = 'NOT_FOUND'; throw error }
  return toOperationalProductDetail(product)
}

module.exports = { searchProductsForPos, getProductForPosById }
