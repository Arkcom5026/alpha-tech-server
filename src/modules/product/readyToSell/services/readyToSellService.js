const { prisma } = require('../../../../lib/prisma')
const { normStr, toInt } = require('../../runtime/shared/operationalProductInput')
const effectivePricePolicy = require('../../pricing/policies/effectivePricePolicy')

const requireBranchId = (branchId) => {
  const brId = toInt(branchId)
  if (!brId) {
    const error = new Error('unauthorized')
    error.statusCode = 401
    error.code = 'unauthorized'
    throw error
  }
  return brId
}

const resolvePrices = (branchPrice, { branchId, productId } = {}) => {
  if (!branchPrice) {
    const error = new Error('ไม่พบราคาที่ใช้งานสำหรับสินค้านี้ในร้านปัจจุบัน')
    error.code = 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
    error.status = 409
    error.statusCode = 409
    error.detail = { branchId, productId }
    throw error
  }

  const resolve = (priceType) => effectivePricePolicy.resolveEffectivePrice({
    row: branchPrice,
    priceType,
    branchId,
    productId,
  })

  return {
    retail: resolve('retail'),
    wholesale: resolve('wholesale'),
    technician: resolve('technician'),
    online: resolve('online'),
  }
}

const isPriceAuthorityError = (error) => error?.code === 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
  || error?.code?.startsWith('PRICE_')

const resolveSellablePrices = (branchPrice, context) => {
  try {
    return resolvePrices(branchPrice, context)
  } catch (error) {
    if (isPriceAuthorityError(error)) return null
    throw error
  }
}

const formatStructuredDisplayCode = (previewBarcode, qty) => {
  const barcode = normStr(previewBarcode)
  if (!barcode) return '-'
  const count = Math.max(0, Number(qty || 0))
  return count > 1 ? `${barcode} +${count - 1}` : barcode
}

const getReadyToSell = async ({ branchId, q = '', search = '', searchText = '', mode = 'ALL', page = 1, pageSize = 25, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const keyword = normStr(q || search || searchText)
  const runtimeMode = String(mode || 'ALL').toUpperCase()
  const currentPage = Math.max(1, toInt(page) ?? 1)
  const pageSizeRaw = toInt(pageSize) ?? 25
  const safePageSize = Math.max(1, Math.min(pageSizeRaw, 100))
  const wantStructured = runtimeMode === 'ALL' || runtimeMode === 'STRUCTURED'
  const wantSimple = runtimeMode === 'ALL' || runtimeMode === 'SIMPLE'
  let structuredItems = []

  if (wantStructured) {
    try {
      let structuredProductIds = []
      if (keyword) {
        const matchedProducts = await db.product.findMany({ where: { name: { contains: keyword, mode: 'insensitive' } }, select: { id: true } })
        structuredProductIds = matchedProducts.map((product) => Number(product.id)).filter(Boolean)
      }
      const grouped = await db.stockItem.groupBy({
        by: ['productId'],
        where: { branchId: brId, status: 'IN_STOCK', ...(keyword ? { productId: { in: structuredProductIds.length ? structuredProductIds : [-1] } } : {}) },
        _count: { _all: true },
        _max: { receivedAt: true },
      })
      const productIds = grouped.map((group) => group.productId)
      const products = await db.product.findMany({
        where: {
          id: { in: productIds },
          branchPrice: { some: { branchId: brId, isActive: true } },
        },
        select: {
          id: true,
          name: true,
          brandId: true,
          brand: { select: { id: true, name: true } },
          unitId: true,
          unit: { select: { id: true, name: true } },
          branchPrice: {
            where: { branchId: brId, isActive: true },
            take: 1,
            select: { priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
          },
        },
      })
      const sellableProducts = products.flatMap((product) => {
        const prices = resolveSellablePrices(product.branchPrice?.[0], { branchId: brId, productId: product.id })
        return prices ? [{ product, prices }] : []
      })
      const productMap = new Map(sellableProducts.map(({ product, prices }) => [product.id, { product, prices }]))
      const sellableProductIds = sellableProducts.map(({ product }) => product.id)
      const structuredBarcodeRows = sellableProductIds.length ? await db.stockItem.findMany({
        where: { branchId: brId, status: 'IN_STOCK', productId: { in: sellableProductIds } },
        select: { productId: true, barcode: true, receivedAt: true, createdAt: true },
        orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
      }) : []
      const structuredPreviewMap = new Map()
      for (const row of structuredBarcodeRows) if (!structuredPreviewMap.has(row.productId)) structuredPreviewMap.set(row.productId, row)
      structuredItems = grouped.flatMap((group) => {
        const entry = productMap.get(group.productId)
        if (!entry) return []
        const { product, prices } = entry
        const preview = structuredPreviewMap.get(group.productId)
        const qty = Number(group._count._all ?? 0)
        return [{
          kind: 'STRUCTURED', productId: group.productId, productName: product.name ?? null,
          brandId: product.brandId ?? product.brand?.id ?? null, brandName: product.brand?.name ?? null,
          unitId: product.unitId ?? product.unit?.id ?? null, unitName: product.unit?.name ?? null,
          unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
          qty, receivedAt: group._max.receivedAt ?? null,
          displayCode: formatStructuredDisplayCode(preview?.barcode, qty), hasDetails: true,
          prices,
        }]
      })
    } catch (error) {
      if (isPriceAuthorityError(error)) throw error
      console.error('❌ structured ready-to-sell summary failed:', error)
      structuredItems = []
    }
  }

  let simpleItems = []
  if (wantSimple) {
    const raw = await db.product.findMany({
      where: {
        active: true, mode: 'SIMPLE', productType: { branchId: brId }, branchPrice: { some: { branchId: brId, isActive: true } },
        ...(keyword ? { OR: [{ name: { contains: keyword, mode: 'insensitive' } }, { saleBarcode: { contains: keyword, mode: 'insensitive' } }] } : {}),
      },
      select: {
        id: true, name: true, inventoryBehavior: true, saleBarcode: true, brandId: true,
        brand: { select: { id: true, name: true } }, unitId: true, unit: { select: { id: true, name: true } },
        branchPrice: {
          where: { branchId: brId, isActive: true },
          take: 1,
          select: { priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
        },
        stockBalances: { where: { branchId: brId }, take: 1, select: { quantity: true, reserved: true, updatedAt: true } },
      },
    })
    simpleItems = raw.flatMap((product) => {
      const balance = product.stockBalances?.[0]
      const available = Math.max(0, Number(balance?.quantity || 0) - Number(balance?.reserved || 0))
      const nonStock = product.inventoryBehavior === 'NON_STOCK'
      if (!nonStock && available <= 0) return []
      const prices = resolveSellablePrices(product.branchPrice?.[0], { branchId: brId, productId: product.id })
      if (!prices) return []
      return [{
        kind: nonStock ? 'NON_STOCK' : 'SIMPLE', productId: product.id, productName: product.name,
        inventoryBehavior: product.inventoryBehavior, saleBarcode: product.saleBarcode, displayCode: product.saleBarcode || '-',
        brandId: product.brandId ?? product.brand?.id ?? null, brandName: product.brand?.name ?? null,
        unitId: product.unitId ?? product.unit?.id ?? null, unitName: product.unit?.name ?? null,
        unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
        qty: nonStock ? null : available, receivedAt: balance?.updatedAt ?? null, status: 'IN_STOCK', hasDetails: false,
        prices,
      }]
    })
  }

  const merged = [...structuredItems, ...simpleItems].sort((a, b) => {
    const firstTime = a?.receivedAt ? new Date(a.receivedAt).getTime() : 0
    const secondTime = b?.receivedAt ? new Date(b.receivedAt).getTime() : 0
    return secondTime - firstTime
  })
  const total = merged.length
  const start = Math.max(0, (currentPage - 1) * safePageSize)
  return { items: merged.slice(start, start + safePageSize), total, page: currentPage, pageSize: safePageSize }
}

const getReadyToSellStructuredDetails = async ({ branchId, productId, q = '', db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const id = toInt(productId)
  if (!id) { const error = new Error('INVALID_PRODUCT_ID'); error.statusCode = 400; error.code = 'INVALID_PRODUCT_ID'; throw error }
  const keyword = normStr(q)
  const items = await db.stockItem.findMany({
    where: {
      branchId: brId, productId: id, status: 'IN_STOCK',
      ...(keyword ? { OR: [{ barcode: { contains: keyword, mode: 'insensitive' } }, { serialNumber: { contains: keyword, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, serialNumber: true, barcode: true, createdAt: true, receivedAt: true, status: true,
      product: { select: {
        id: true, name: true, productConfig: true, brand: { select: { id: true, name: true } }, unitId: true,
        unit: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, globalProductType: { select: { category: { select: { id: true, name: true } } } } } },
        branchPrice: { where: { branchId: brId, isActive: true }, select: { costPrice: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true, isActive: true, updatedAt: true }, take: 1 },
      } },
    },
  })

  const projected = items.map((item) => ({
    ...item,
    product: {
      ...item.product,
      prices: resolvePrices(item.product?.branchPrice?.[0], { branchId: brId, productId: id }),
    },
  }))

  return { items: projected, total: projected.length }
}

module.exports = { getReadyToSell, getReadyToSellStructuredDetails, resolvePrices, formatStructuredDisplayCode }
