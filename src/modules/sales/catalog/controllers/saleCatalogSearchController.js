// src/modules/sales/catalog/controllers/saleCatalogSearchController.js

const prismaModule = require('../../../../../lib/prisma')
const prisma = prismaModule?.prisma || prismaModule

const toInt = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const toNumber = (value) => {
  if (value && typeof value.toNumber === 'function') return value.toNumber()
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeInventoryBehavior = (product) => {
  const configured = String(product?.inventoryBehavior || product?.productConfig?.inventoryBehavior || '').trim().toUpperCase()
  return configured === 'NON_STOCK' ? 'NON_STOCK' : 'TRACKED'
}

const pricesOf = (branchPrice) => ({
  retail: toNumber(branchPrice?.priceRetail),
  wholesale: toNumber(branchPrice?.priceWholesale),
  technician: toNumber(branchPrice?.priceTechnician),
  online: toNumber(branchPrice?.priceOnline),
})

const setNoStoreHeaders = (res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  })
}

const resolveExactStockItem = async ({ branchId, query }) => {
  const item = await prisma.stockItem.findFirst({
    where: {
      branchId,
      OR: [{ barcode: { equals: query } }, { serialNumber: { equals: query } }],
    },
    include: { product: true },
  })

  if (!item) return null
  if (item.status !== 'IN_STOCK') {
    return {
      error: {
        statusCode: 409,
        body: {
          code: 'BARCODE_NOT_SELLABLE',
          status: item.status,
          message: `สินค้านี้ไม่พร้อมขาย (สถานะ: ${item.status})`,
        },
      },
    }
  }

  const branchPrice = await prisma.branchPrice.findFirst({
    where: { branchId, productId: item.productId, isActive: true },
  })

  return {
    items: [{
      ...item,
      kind: 'SN',
      lineType: 'STOCK_ITEM',
      stockItemId: item.id,
      inventoryBehavior: 'TRACKED',
      prices: pricesOf(branchPrice),
    }],
  }
}

const resolveExactSimpleLot = async ({ branchId, query }) => {
  const barcodeItem = await prisma.barcodeReceiptItem.findUnique({
    where: { barcode: query },
    include: {
      simpleLot: true,
      receiptItem: {
        include: {
          receipt: true,
          product: true,
          purchaseOrderItem: { include: { product: true } },
        },
      },
    },
  })

  if (!barcodeItem || toInt(barcodeItem.branchId) !== branchId) return null
  if (barcodeItem.kind !== 'LOT' && barcodeItem.simpleLotId == null) return null

  const product = barcodeItem.receiptItem?.product || barcodeItem.receiptItem?.purchaseOrderItem?.product
  if (!product) {
    return { error: { statusCode: 400, body: { code: 'LOT_PRODUCT_MISSING', message: 'ไม่พบข้อมูลสินค้าในบาร์โค้ดล็อต' } } }
  }

  const qtyRemaining = barcodeItem.simpleLot
    ? toNumber(barcodeItem.simpleLot.qtyRemaining)
    : toNumber(barcodeItem.receiptItem?.quantity)

  if (qtyRemaining <= 0) {
    return { error: { statusCode: 409, body: { code: 'LOT_EMPTY', status: 'OUT_OF_STOCK', message: 'ล็อตนี้ไม่มีจำนวนคงเหลือให้ขายแล้ว' } } }
  }

  const branchPrice = await prisma.branchPrice.findFirst({
    where: { branchId, productId: product.id, isActive: true },
  })

  return {
    items: [{
      kind: 'LOT',
      lineType: 'SIMPLE',
      status: 'IN_STOCK',
      stockItemId: null,
      barcode: barcodeItem.barcode,
      simpleLotId: barcodeItem.simpleLotId || barcodeItem.simpleLot?.id || null,
      productId: product.id,
      product,
      inventoryBehavior: 'TRACKED',
      qtyRemaining,
      prices: pricesOf(branchPrice),
    }],
  }
}

const findSimpleProducts = async ({ branchId, query, take = 20 }) => {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      mode: 'SIMPLE',
      branchPrice: { some: { branchId, isActive: true } },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { saleBarcode: { equals: query } },
        { productConfig: { path: ['saleBarcode'], equals: query } },
        { productConfig: { path: ['barcode'], equals: query } },
        { productConfig: { path: ['serviceCode'], equals: query } },
      ],
    },
    include: {
      branchPrice: { where: { branchId, isActive: true }, take: 1 },
      stockBalances: { where: { branchId }, take: 1 },
      simpleLots: {
        where: { branchId, status: 'ACTIVE', qtyRemaining: { gt: 0 } },
        orderBy: { receivedAt: 'asc' },
        take: 1,
      },
    },
    orderBy: { id: 'asc' },
    take,
  })

  return products.flatMap((product) => {
    const inventoryBehavior = normalizeInventoryBehavior(product)
    const balance = product.stockBalances?.[0]
    const qtyRemaining = Math.max(0, toNumber(balance?.quantity) - toNumber(balance?.reserved))

    if (inventoryBehavior === 'TRACKED' && qtyRemaining <= 0) return []

    const configuredBarcode = product.saleBarcode
      || product.productConfig?.saleBarcode
      || product.productConfig?.barcode
      || product.productConfig?.serviceCode
      || ''

    return [{
      id: product.id,
      kind: inventoryBehavior === 'NON_STOCK' ? 'NON_STOCK' : 'SIMPLE',
      lineType: 'SIMPLE',
      status: 'IN_STOCK',
      stockItemId: null,
      simpleLotId: inventoryBehavior === 'TRACKED' ? (product.simpleLots?.[0]?.id ?? null) : null,
      productId: product.id,
      product,
      productName: product.name,
      barcode: String(configuredBarcode || ''),
      inventoryBehavior,
      qtyRemaining: inventoryBehavior === 'NON_STOCK' ? null : qtyRemaining,
      prices: pricesOf(product.branchPrice?.[0]),
    }]
  })
}

const findStockItems = async ({ branchId, query, take = 20 }) => {
  const items = await prisma.stockItem.findMany({
    where: {
      status: 'IN_STOCK',
      branchId,
      OR: [
        { product: { name: { contains: query, mode: 'insensitive' } } },
        { barcode: { contains: query } },
        { serialNumber: { contains: query } },
      ],
    },
    include: { product: true },
    orderBy: { id: 'asc' },
    take,
  })

  const productIds = [...new Set(items.map((item) => item.productId))]
  const branchPrices = productIds.length
    ? await prisma.branchPrice.findMany({ where: { branchId, productId: { in: productIds }, isActive: true } })
    : []
  const priceMap = new Map(branchPrices.map((price) => [price.productId, price]))

  return items.map((item) => ({
    ...item,
    kind: 'SN',
    lineType: 'STOCK_ITEM',
    stockItemId: item.id,
    inventoryBehavior: 'TRACKED',
    prices: pricesOf(priceMap.get(item.productId)),
  }))
}

const searchSaleCatalog = async (req, res) => {
  try {
    const query = String(req.query?.query || req.query?.barcode || '').trim()
    const branchId = toInt(req.user?.branchId)
    if (!query || !branchId) return res.status(400).json({ error: 'Missing query or branchId' })

    setNoStoreHeaders(res)

    const exactStock = await resolveExactStockItem({ branchId, query })
    if (exactStock?.error) return res.status(exactStock.error.statusCode).json(exactStock.error.body)
    if (exactStock?.items) return res.json(exactStock.items)

    const exactLot = await resolveExactSimpleLot({ branchId, query })
    if (exactLot?.error) return res.status(exactLot.error.statusCode).json(exactLot.error.body)
    if (exactLot?.items) return res.json(exactLot.items)

    const [simpleItems, stockItems] = await Promise.all([
      findSimpleProducts({ branchId, query, take: 20 }),
      findStockItems({ branchId, query, take: 20 }),
    ])

    const result = [...simpleItems, ...stockItems].slice(0, 20)
    if (!result.length) {
      return res.status(404).json({ code: 'SALE_CATALOG_ITEM_NOT_FOUND', message: 'ไม่พบสินค้าหรือบริการที่พร้อมขาย' })
    }

    return res.json(result)
  } catch (error) {
    console.error('[searchSaleCatalog] error:', error)
    return res.status(500).json({ code: 'SALE_CATALOG_SEARCH_FAILED', message: 'เกิดข้อผิดพลาดในการค้นหาสินค้าหรือบริการ' })
  }
}

module.exports = { searchSaleCatalog }
