const { prisma } = require('../../../../lib/prisma')
const { decideOperationalProductMode } = require('../policies/operationalProductModePolicy')
const {
  calcAvailable,
  isReadyProduct,
} = require('../calculations/operationalStockAvailability')
const {
  createLocalOperationalProductRecord,
  createOperationalProductRecordFromTemplate,
  fetchOperationalRuntimeProduct,
  findBranchProductTypeByGlobalProductTypeId,
  findOperationalRuntimeProductByTemplateId,
  findOperationalProductDetailById,
  findOperationalProductList,
  findOperationalOnlineProductList,
  findOperationalOnlineProductDetailById,
  findStockItemByBarcode,
  findStockItemBySerialNumber,
  findTemplateBranchByCode,
  findTemplateProductForClone,
  findBranchProductTypeForCreate,
  selectOperationalRuntimeProduct,
  selectOperationalProductDetail,
  selectOperationalOnlineProduct,
  transaction,
  upsertBranchPriceForProduct,
  autoLearnProductTypeBrandRelation,
} = require('../repositories/operationalProductRuntimeRepository')

const { toOperationalRuntimeProduct } = require('../mappers/operationalRuntimeProductMapper')
const { toOperationalProductPosSearchItem } = require('../mappers/operationalProductPosSearchMapper')
const {
  toOperationalProductOnlineSearchItem,
  toOperationalOnlineProductDetail,
} = require('../mappers/operationalProductOnlineMapper')
const { toOperationalProductDetail } = require('../mappers/operationalProductDetailMapper')

const {
  normStr,
  pickBranchPricePayload,
  toInt,
  toNum,
} = require('../shared/operationalProductInput')

const requireBranchId = (branchId, code = 'BRANCH_ID_MISSING') => {
  const brId = toInt(branchId)
  if (!brId) {
    const error = new Error(code)
    error.statusCode = code === 'BRANCH_REQUIRED' ? 400 : 401
    error.code = code
    throw error
  }
  return brId
}

const autoLearnProductTypeBrand = async (db, productTypeId, brandId) => {
  try {
    await autoLearnProductTypeBrandRelation({
      productTypeId,
      brandId,
      db,
    })
  } catch (error) {
    console.warn('autoLearnProductTypeBrand failed:', error?.message || error)
  }
}



const createLocalOperationalProduct = async ({ branchId, data = {}, db = prisma }) => {
  const brId = requireBranchId(branchId)

  if (data.branchId !== undefined) {
    const error = new Error('BODY_BRANCH_ID_NOT_ALLOWED')
    error.statusCode = 400
    error.code = 'BODY_BRANCH_ID_NOT_ALLOWED'
    throw error
  }

  if (data.templateProductId !== undefined) {
    const error = new Error('TEMPLATE_PRODUCT_ID_NOT_ALLOWED')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_NOT_ALLOWED'
    throw error
  }

  if (Array.isArray(data.barcodes) || Array.isArray(data.items)) {
    const error = new Error('STOCK_QUEUE_NOT_ALLOWED')
    error.statusCode = 400
    error.code = 'STOCK_QUEUE_NOT_ALLOWED'
    throw error
  }

  const name = normStr(data.name)
  if (!name) {
    const error = new Error('NAME_REQUIRED')
    error.statusCode = 400
    error.code = 'NAME_REQUIRED'
    throw error
  }

  const productTypeId = toInt(data.productTypeId)
  if (!productTypeId) {
    const error = new Error('PRODUCT_TYPE_REQUIRED')
    error.statusCode = 400
    error.code = 'PRODUCT_TYPE_REQUIRED'
    throw error
  }

  const pricePayload = pickBranchPricePayload(data)
  if (!pricePayload) {
    const error = new Error('BRANCH_PRICE_REQUIRED')
    error.statusCode = 400
    error.code = 'BRANCH_PRICE_REQUIRED'
    throw error
  }

  const costPrice = toNum(pricePayload.costPrice)
  const priceRetail = toNum(pricePayload.priceRetail)

  if (!costPrice || costPrice <= 0) {
    const error = new Error('COST_PRICE_REQUIRED')
    error.statusCode = 400
    error.code = 'COST_PRICE_REQUIRED'
    throw error
  }

  if (!priceRetail || priceRetail <= 0) {
    const error = new Error('PRICE_RETAIL_REQUIRED')
    error.statusCode = 400
    error.code = 'PRICE_RETAIL_REQUIRED'
    throw error
  }

  const result = await transaction(async (tx) => {
    const productType = await findBranchProductTypeForCreate({
      branchId: brId,
      productTypeId,
      db: tx,
    })

    if (!productType) {
      const error = new Error('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH')
      error.statusCode = 400
      error.status = 400
      error.code = 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
      throw error
    }

    const { mode, noSN, trackSerialNumber } = decideOperationalProductMode({
      explicitMode: data.mode ?? data.stockMode ?? data.stockBehavior,
      noSN: data.noSN,
      trackSerialNumber: data.trackSerialNumber,
      inventoryBehavior: data.inventoryBehavior,
    })

    const product = await createLocalOperationalProductRecord({
      db: tx,
      data: {
        name,
        mode,
        noSN,
        trackSerialNumber,
        active: typeof data.active === 'boolean' ? data.active : true,
        templateProductId: null,
        productTypeId: productType.id,
        categoryId: productType.globalProductType?.categoryId ?? null,
        brandId: data.brandId === null ? null : toInt(data.brandId),
        unitId: data.unitId === null ? null : toInt(data.unitId),
      },
    })

    const branchPriceData = {
      costPrice,
      priceRetail,
      priceWholesale: toNum(pricePayload.priceWholesale),
      priceTechnician: toNum(pricePayload.priceTechnician),
      priceOnline: toNum(pricePayload.priceOnline),
      isActive: typeof pricePayload.isActive === 'boolean' ? pricePayload.isActive : true,
    }

    await upsertBranchPriceForProduct({
      productId: product.id,
      branchId: brId,
      data: branchPriceData,
      db: tx,
    })

    await autoLearnProductTypeBrand(tx, productType.id, data.brandId)

    return fetchOperationalRuntimeProduct(product.id, brId, tx)
  }, { timeout: 15000 }, db)

  const mapped = toOperationalRuntimeProduct(result, brId)

  return {
    success: true,
    created: true,
    data: mapped,
    product: mapped,
    branchId: brId,
  }
}


const createOperationalProductFromTemplate = async ({ branchId, templateProductId, db = prisma }) => {
  const brId = requireBranchId(branchId)
  const tplId = toInt(templateProductId)

  if (!tplId) {
    const error = new Error('TEMPLATE_PRODUCT_ID_MISSING')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_MISSING'
    throw error
  }

  const templateBranch = await findTemplateBranchByCode({
    branchCode: 'T01',
    db,
  })

  if (!templateBranch) {
    const error = new Error('TEMPLATE_BRANCH_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
    throw error
  }

  const template = await findTemplateProductForClone({
    templateProductId: tplId,
    templateBranchId: templateBranch.id,
    db,
  })

  if (!template) {
    const error = new Error('TEMPLATE_PRODUCT_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_PRODUCT_NOT_FOUND'
    throw error
  }

  const existing = await findOperationalRuntimeProductByTemplateId({
    branchId: brId,
    templateProductId: tplId,
    db,
  })

  if (existing) {
    const mapped = toOperationalRuntimeProduct(existing, brId)
    return {
      success: true,
      created: false,
      exists: true,
      data: mapped,
      product: mapped,
      templateProductId: tplId,
      branchId: brId,
      statusCode: 200,
    }
  }

  const branchType = await findBranchProductTypeByGlobalProductTypeId({
    branchId: brId,
    globalProductTypeId: template.productType?.globalProductTypeId,
    db,
  })

  if (!branchType) {
    const error = new Error('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH')
    error.statusCode = 400
    error.code = 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
    throw error
  }

  const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true

  const created = await createOperationalProductRecordFromTemplate({
    db,
    data: {
      name: template.name,
      mode: structured ? 'STRUCTURED' : 'SIMPLE',
      noSN: !structured,
      trackSerialNumber: structured,
      active: true,
      templateProductId: tplId,
      productTypeId: branchType.id,
      categoryId: branchType.globalProductType?.categoryId ?? null,
      brandId: template.brandId ?? null,
      unitId: template.unitId ?? null,
    },
  })

  const runtime = await fetchOperationalRuntimeProduct(created.id, brId, db)
  const mapped = toOperationalRuntimeProduct(runtime, brId)

  return {
    success: true,
    created: true,
    exists: false,
    data: mapped,
    product: mapped,
    templateProductId: tplId,
    branchId: brId,
    statusCode: 201,
  }
}


const findOperationalProductByTemplateId = async ({ branchId, templateProductId, db = prisma }) => {
  const brId = requireBranchId(branchId)
  const tplId = toInt(templateProductId)

  if (!tplId) {
    const error = new Error('TEMPLATE_PRODUCT_ID_MISSING')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_MISSING'
    throw error
  }

  const product = await findOperationalRuntimeProductByTemplateId({
    branchId: brId,
    templateProductId: tplId,
    db,
  })

  const mapped = toOperationalRuntimeProduct(product)

  return {
    success: true,
    exists: !!product,
    data: mapped,
    product: mapped,
    templateProductId: tplId,
    branchId: brId,
  }
}

const findOperationalProductById = async ({ branchId, productId, db = prisma }) => {
  const brId = requireBranchId(branchId, 'unauthorized')
  const id = toInt(productId)

  if (!id) {
    const error = new Error('INVALID_ID')
    error.statusCode = 400
    error.code = 'INVALID_ID'
    throw error
  }

  const product = await findOperationalProductDetailById({
    branchId: brId,
    productId: id,
    db,
  })

  if (!product) {
    const error = new Error('NOT_FOUND')
    error.statusCode = 404
    error.code = 'NOT_FOUND'
    throw error
  }

  return toOperationalProductDetail(product)
}

const findOperationalProducts = async ({
  branchId,
  search = '',
  take = 50,
  page = 1,
  productTypeId,
  brandId,
  readyOnly = 'false',
  hasPrice = 'false',
  activeOnly = 'true',
  includeInactive = '0',
  mode,
  simpleOnly,
  db = prisma,
} = {}) => {
  const brId = requireBranchId(branchId, 'unauthorized')

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

  const q = normStr(search)
  if (q) {
    whereAND.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }] })
  }

  const typeId = toInt(productTypeId)
  const brdId = toInt(brandId)

  if (typeId) whereAND.push({ productTypeId: typeId })
  if (brdId) whereAND.push({ brandId: brdId })

  const items = await findOperationalProductList({
    branchId: brId,
    where: { AND: whereAND },
    take: takeNum,
    skip: skipNum,
    db,
  })

  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()]
  let mapped = uniqueItems.map(toOperationalProductPosSearchItem)

  if (String(readyOnly).toLowerCase() === 'true') mapped = mapped.filter((x) => x.isReady)
  if (String(hasPrice).toLowerCase() === 'true') {
    mapped = mapped.filter((x) => x.hasPrice && x.branchPriceActive !== false)
  }

  return mapped
}

const findOperationalProductsForPOS = findOperationalProducts

const findOperationalProductsForOnline = async ({
  branchId,
  search = '',
  take = 50,
  size,
  page = 1,
  productTypeId,
  brandId,
  readyOnly = 'false',
  hasPrice = 'false',
  mode,
  simpleOnly,
  db = prisma,
} = {}) => {
  const brId = toInt(branchId)

  if (!brId) {
    const error = new Error('BRANCH_REQUIRED')
    error.statusCode = 400
    error.code = 'BRANCH_REQUIRED'
    throw error
  }

  const takeNum = Math.max(1, Math.min((toInt(size) ?? toInt(take) ?? 50), 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  const queryMode = String(mode || '').toUpperCase()
  const wantSimpleOnly = simpleOnly === '1' || simpleOnly === true || queryMode === 'SIMPLE'

  const whereAND = [{ productType: { branchId: brId } }]
  if (wantSimpleOnly) whereAND.push({ mode: 'SIMPLE' })

  const q = normStr(search)
  if (q) whereAND.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }] })

  const typeId = toInt(productTypeId)
  const brdId = toInt(brandId)

  if (typeId) whereAND.push({ productTypeId: typeId })
  if (brdId) whereAND.push({ brandId: brdId })

  const items = await findOperationalOnlineProductList({
    branchId: brId,
    where: whereAND.length ? { AND: whereAND } : {},
    take: takeNum,
    skip: skipNum,
    db,
  })

  let mapped = items.map(toOperationalProductOnlineSearchItem)

  if (String(readyOnly).toLowerCase() === 'true') mapped = mapped.filter((x) => x.isReady === true)
  if (String(hasPrice).toLowerCase() === 'true') {
    mapped = mapped.filter((x) => x.hasPrice === true && x.branchPriceActive !== false)
  }

  return mapped
}

const findOperationalProductOnlineById = async ({ branchId, productId, db = prisma }) => {
  const brId = toInt(branchId)

  if (!brId) {
    const error = new Error('BRANCH_REQUIRED')
    error.statusCode = 400
    error.code = 'BRANCH_REQUIRED'
    throw error
  }

  const id = toInt(productId)
  if (!id) {
    const error = new Error('INVALID_ID')
    error.statusCode = 400
    error.code = 'INVALID_ID'
    throw error
  }

  const product = await findOperationalOnlineProductDetailById({
    branchId: brId,
    productId: id,
    db,
  })

  if (!product) {
    const error = new Error('NOT_FOUND')
    error.statusCode = 404
    error.code = 'NOT_FOUND'
    throw error
  }

  return toOperationalOnlineProductDetail(product)
}

const findOperationalProductByBarcode = async ({ branchId, barcode, db = prisma }) => {
  const brId = requireBranchId(branchId)
  const code = normStr(barcode)

  if (!code) {
    const error = new Error('BARCODE_REQUIRED')
    error.statusCode = 400
    error.code = 'BARCODE_REQUIRED'
    throw error
  }

  return findStockItemByBarcode({
    branchId: brId,
    barcode: code,
    db,
  })
}

const findOperationalProductBySerial = async ({ branchId, serialNumber, db = prisma }) => {
  const brId = requireBranchId(branchId)
  const serial = normStr(serialNumber)

  if (!serial) {
    const error = new Error('SERIAL_NUMBER_REQUIRED')
    error.statusCode = 400
    error.code = 'SERIAL_NUMBER_REQUIRED'
    throw error
  }

  return findStockItemBySerialNumber({
    branchId: brId,
    serialNumber: serial,
    db,
  })
}


const getReadyToSell = async ({
  branchId,
  q = '',
  search = '',
  searchText = '',
  mode = 'ALL',
  page = 1,
  pageSize = 25,
  db = prisma,
} = {}) => {
  const brId = requireBranchId(branchId, 'unauthorized')
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
        const matchedProducts = await db.product.findMany({
          where: { name: { contains: keyword, mode: 'insensitive' } },
          select: { id: true },
        })
        structuredProductIds = matchedProducts.map((p) => Number(p.id)).filter(Boolean)
      }

      const grouped = await db.stockItem.groupBy({
        by: ['productId'],
        where: {
          branchId: brId,
          status: 'IN_STOCK',
          ...(keyword ? { productId: { in: structuredProductIds.length ? structuredProductIds : [-1] } } : {}),
        },
        _count: { _all: true },
        _max: { receivedAt: true },
      })

      const productIds = grouped.map((g) => g.productId)

      const products = await db.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          brandId: true,
          brand: { select: { id: true, name: true } },
          unitId: true,
          unit: { select: { id: true, name: true } },
        },
      })

      const productMap = new Map(products.map((p) => [p.id, p]))
      const structuredBarcodeRows = productIds.length
        ? await db.stockItem.findMany({
            where: {
              branchId: brId,
              status: 'IN_STOCK',
              productId: { in: productIds },
            },
            select: { productId: true, barcode: true, receivedAt: true, createdAt: true },
            orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
          })
        : []

      const structuredPreviewMap = new Map()
      for (const row of structuredBarcodeRows) {
        if (!structuredPreviewMap.has(row.productId)) {
          structuredPreviewMap.set(row.productId, row)
        }
      }

      structuredItems = grouped.map((g) => {
        const p = productMap.get(g.productId)
        const preview = structuredPreviewMap.get(g.productId)
        const qty = Number(g._count._all ?? 0)
        const previewBarcode = normStr(preview?.barcode)

        return {
          kind: 'STRUCTURED',
          productId: g.productId,
          productName: p?.name ?? null,
          brandId: p?.brandId ?? p?.brand?.id ?? null,
          brandName: p?.brand?.name ?? null,
          unitId: p?.unitId ?? p?.unit?.id ?? null,
          unitName: p?.unit?.name ?? null,
          unit: p?.unit ? { id: p.unit.id, name: p.unit.name } : null,
          qty,
          receivedAt: g._max.receivedAt ?? null,
          displayCode: qty <= 1 ? (previewBarcode || '-') : 'หลายบาร์โค้ด',
          hasDetails: true,
        }
      })
    } catch (error) {
      console.error('❌ structured ready-to-sell summary failed:', error)
      structuredItems = []
    }
  }

  let simpleItems = []

  if (wantSimple) {
    try {
      const raw = await db.stockBalance.findMany({
        where: {
          branchId: brId,
          product: {
            is: {
              OR: [{ mode: 'SIMPLE' }, { noSN: true }],
              ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
            },
          },
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          reserved: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              brandId: true,
              brand: { select: { id: true, name: true } },
              unitId: true,
              unit: { select: { id: true, name: true } },
            },
          },
        },
      })

      simpleItems = raw
        .map((r) => {
          const quantity = Number(r.quantity ?? 0)
          const reserved = Number(r.reserved ?? 0)
          const available = Math.max(0, quantity - reserved)

          return {
            kind: 'SIMPLE',
            productId: r.productId,
            productName: r.product?.name ?? null,
            brandId: r.product?.brandId ?? r.product?.brand?.id ?? null,
            brandName: r.product?.brand?.name ?? null,
            unitId: r.product?.unitId ?? r.product?.unit?.id ?? null,
            unitName: r.product?.unit?.name ?? null,
            unit: r.product?.unit ? { id: r.product.unit.id, name: r.product.unit.name } : null,
            qty: available,
            receivedAt: r.updatedAt ?? null,
            status: 'IN_STOCK',
            hasDetails: false,
          }
        })
        .filter((x) => x.qty > 0)
    } catch (_error) {
      simpleItems = []
    }
  }

  const merged = [...structuredItems, ...simpleItems].sort((a, b) => {
    const ta = a?.receivedAt ? new Date(a.receivedAt).getTime() : 0
    const tb = b?.receivedAt ? new Date(b.receivedAt).getTime() : 0
    return tb - ta
  })

  const total = merged.length
  const start = Math.max(0, (currentPage - 1) * safePageSize)
  const end = start + safePageSize

  return {
    items: merged.slice(start, end),
    total,
    page: currentPage,
    pageSize: safePageSize,
  }
}

const getReadyToSellStructuredDetails = async ({
  branchId,
  productId,
  q = '',
  db = prisma,
} = {}) => {
  const brId = requireBranchId(branchId, 'unauthorized')
  const id = toInt(productId)

  if (!id) {
    const error = new Error('INVALID_PRODUCT_ID')
    error.statusCode = 400
    error.code = 'INVALID_PRODUCT_ID'
    throw error
  }

  const keyword = normStr(q)

  const items = await db.stockItem.findMany({
    where: {
      branchId: brId,
      productId: id,
      status: 'IN_STOCK',
      ...(keyword
        ? {
            OR: [
              { barcode: { contains: keyword, mode: 'insensitive' } },
              { serialNumber: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      serialNumber: true,
      barcode: true,
      createdAt: true,
      receivedAt: true,
      status: true,
      product: {
        select: {
          id: true,
          name: true,
          productConfig: true,
          brand: { select: { id: true, name: true } },
          unitId: true,
          unit: { select: { id: true, name: true } },
          productType: {
            select: {
              id: true,
              name: true,
              globalProductType: {
                select: {
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          branchPrice: {
            where: { branchId: brId },
            select: {
              costPrice: true,
              priceRetail: true,
              priceWholesale: true,
              priceTechnician: true,
              priceOnline: true,
              isActive: true,
              updatedAt: true,
            },
            take: 1,
          },
        },
      },
    },
  })

  return {
    items,
    total: items.length,
  }
}


module.exports = {
  createLocalOperationalProduct,
  getReadyToSell,
  getReadyToSellStructuredDetails,
  createOperationalProductFromTemplate,
  findOperationalProductById,
  findOperationalProductByTemplateId,
  findOperationalProducts,
  findOperationalProductsForPOS,
  findOperationalProductsForOnline,
  findOperationalProductOnlineById,
  findOperationalProductByBarcode,
  findOperationalProductBySerial,
  toOperationalRuntimeProduct,
}
