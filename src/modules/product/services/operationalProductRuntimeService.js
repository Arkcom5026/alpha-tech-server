const { prisma } = require('../../../../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const toNum = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(typeof value === 'string' ? value.trim().replace(/,/g, '') : value)
  return Number.isFinite(n) ? n : undefined
}

const normStr = (value) => (value == null ? '' : String(value)).trim()

const pickBranchPricePayload = (data = {}) => {
  const d = data && typeof data === 'object' ? data : {}
  const bp = d.branchPrice && typeof d.branchPrice === 'object' ? d.branchPrice : {}

  const hasNested = [
    'costPrice',
    'priceRetail',
    'priceWholesale',
    'priceTechnician',
    'priceOnline',
    'isActive',
  ].some((key) => bp[key] !== undefined)

  if (hasNested) return bp

  const flat = {
    costPrice: d.costPrice,
    priceRetail: d.priceRetail,
    priceWholesale: d.priceWholesale,
    priceTechnician: d.priceTechnician,
    priceOnline: d.priceOnline,
    isActive: d.branchPriceActive ?? d.isActive,
  }

  const hasFlat = [
    'costPrice',
    'priceRetail',
    'priceWholesale',
    'priceTechnician',
    'priceOnline',
    'isActive',
  ].some((key) => flat[key] !== undefined)

  return hasFlat ? flat : null
}

const decideLocalMode = ({ explicitMode, noSN, trackSerialNumber }) => {
  const rawMode = explicitMode === undefined || explicitMode === null ? '' : String(explicitMode).trim()
  const exp = rawMode ? rawMode.toUpperCase() : undefined
  const hasNoSN = noSN !== undefined
  const hasTrack = trackSerialNumber !== undefined
  const n = noSN === true || noSN === 'true' || noSN === 1 || noSN === '1'
  const t = trackSerialNumber === true || trackSerialNumber === 'true' || trackSerialNumber === 1 || trackSerialNumber === '1'

  if (exp === 'SIMPLE' || exp === 'NOSN' || exp === 'NO_SN' || exp === 'NO-SN') {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }

  if (exp === 'STRUCTURED' || exp === 'SN') {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }

  if (hasNoSN || hasTrack) {
    if (t) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
    if (hasNoSN && n === false) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
    if (hasNoSN && n === true) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
    if (hasTrack && t === false) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }

  return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
}

const selectOperationalRuntimeProduct = (branchId) => ({
  id: true,
  active: true,
  name: true,
  mode: true,
  noSN: true,
  trackSerialNumber: true,
  templateProductId: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: {
      id: true,
      branchId: true,
      costPrice: true,
      priceRetail: true,
      priceOnline: true,
      priceWholesale: true,
      priceTechnician: true,
      isActive: true,
    },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    take: 1,
    select: { id: true },
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: {
      quantity: true,
      reserved: true,
      lastReceivedCost: true,
    },
  },
})

const selectOperationalProductDetail = (branchId) => ({
  id: true,
  name: true,
  mode: true,
  noSN: true,
  trackSerialNumber: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { active: true },
    orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
    select: { id: true, url: true, secure_url: true, caption: true, isCover: true },
  },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: {
      costPrice: true,
      priceWholesale: true,
      priceTechnician: true,
      priceRetail: true,
      priceOnline: true,
      isActive: true,
    },
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: { quantity: true, reserved: true, lastReceivedCost: true },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    select: { id: true },
    take: 1,
  },
})

const selectOperationalOnlineProduct = (branchId) => ({
  id: true,
  name: true,
  mode: true,
  noSN: true,
  productTypeId: true,
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
  brandId: true,
  brand: { select: { id: true, name: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { isCover: true, active: true },
    take: 1,
    select: { secure_url: true, url: true },
  },
  branchPrice: {
    where: { branchId },
    take: 1,
    select: { priceOnline: true, isActive: true },
  },
  stockItems: {
    where: { branchId, status: 'IN_STOCK' },
    select: { id: true },
    take: 1,
  },
  stockBalances: {
    where: { branchId },
    take: 1,
    select: { quantity: true, reserved: true },
  },
})

const calcAvailable = (stockBalance) => {
  const quantity = Number(stockBalance?.quantity ?? 0)
  const reserved = Number(stockBalance?.reserved ?? 0)
  return { quantity, reserved, available: Math.max(0, quantity - reserved) }
}

const isSimpleProduct = (product) => product?.mode === 'SIMPLE' || product?.noSN === true

const isReadyProduct = (product, available) => {
  if (isSimpleProduct(product)) return available > 0
  return (product?.stockItems?.length ?? 0) > 0
}

const toOperationalRuntimeProduct = (p, branchId = null) => {
  if (!p) return null

  const bp = p.branchPrice?.[0] || null
  const sb = p.stockBalances?.[0] || null
  const { quantity, reserved, available } = calcAvailable(sb)
  const category = p.productType?.globalProductType?.category || null
  const productTypeName = p.productType?.name ?? '-'

  return {
    id: p.id,
    active: typeof p.active === 'boolean' ? p.active : true,
    name: p.name,
    mode: p.mode,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,

    templateProductId: p.templateProductId,
    isTemplateProduct: false,
    isOperationalProduct: true,

    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    category: category?.name ?? '-',

    productTypeId: p.productTypeId ?? null,
    productTypeName,
    productType: productTypeName,

    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,

    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,

    costPrice: Number(bp?.costPrice ?? sb?.lastReceivedCost ?? 0),
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
    branchPriceActive: bp?.isActive ?? false,
    hasPrice: !!bp,

    available,
    stockBalance: sb ? { quantity, reserved, available, lastReceivedCost: sb.lastReceivedCost } : null,

    branchPrice: bp ? [bp] : [],
    ...(branchId ? { branchId } : {}),
  }
}

const toOperationalProductPosSearchItem = (p) => {
  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)

  const lastCost =
    sb?.lastReceivedCost != null
      ? Number(sb.lastReceivedCost)
      : bp?.costPrice != null
        ? Number(bp.costPrice)
        : null

  const catName = p.productType?.globalProductType?.category?.name ?? '-'
  const typeName = p.productType?.name ?? '-'

  return {
    id: p.id,
    active: typeof p.active === 'boolean' ? p.active : true,
    name: p.name,
    mode: p.mode,
    categoryId: p.productType?.globalProductType?.category?.id ?? null,
    productTypeId: p.productTypeId ?? null,
    category: catName,
    productType: typeName,
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
    branchPriceActive: bp?.isActive ?? true,
    available,
    isReady,
    lastCost,
    costPrice: lastCost,
    hasPrice: !!bp,
  }
}

const toOperationalProductOnlineSearchItem = (p) => {
  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)
  const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

  return {
    id: p.id,
    name: p.name,
    mode: p.mode,
    categoryId: p.productType?.globalProductType?.category?.id ?? null,
    productTypeId: p.productTypeId ?? null,
    imageUrl,
    priceOnline: Number(bp?.priceOnline ?? 0),
    priceOnlineEffective: bp && bp.isActive === false ? null : Number(bp?.priceOnline ?? 0),
    readyPickupAtBranch: isReady,
    isReady,
    category: p.productType?.globalProductType?.category?.name,
    productType: p.productType?.name,
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    hasPrice: !!bp,
    branchPriceActive: bp?.isActive ?? true,
  }
}

const toOperationalProductDetail = (p) => {
  if (!p) return null

  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)

  const lastCost =
    sb?.lastReceivedCost != null
      ? Number(sb.lastReceivedCost)
      : bp?.costPrice != null
        ? Number(bp.costPrice)
        : null

  const mode = p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED')
  const catName = p.productType?.globalProductType?.category?.name ?? '-'
  const typeName = p.productType?.name ?? '-'

  const branchPriceObj = {
    costPrice: Number(bp?.costPrice ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
  }

  return {
    id: p.id,
    name: p.name,
    spec: null,
    mode,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    categoryId: p.productType?.globalProductType?.categoryId ?? null,
    productTypeId: p.productTypeId ?? null,
    productProfileId: null,
    templateId: null,
    productTemplateId: null,
    categoryName: catName,
    productTypeName: typeName,
    productProfileName: '-',
    productTemplateName: '-',
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    images: (p.productImages || [])
      .map((im) => ({
        id: im.id,
        url: im.secure_url || im.url,
        caption: im.caption ?? '',
        isCover: Boolean(im.isCover),
      }))
      .filter((im) => !!im.url),
    costPrice: branchPriceObj.costPrice,
    priceWholesale: branchPriceObj.priceWholesale,
    priceTechnician: branchPriceObj.priceTechnician,
    priceRetail: branchPriceObj.priceRetail,
    priceOnline: branchPriceObj.priceOnline,
    branchPriceActive: bp?.isActive ?? true,
    available,
    isReady,
    lastCost,
    branchPrice: branchPriceObj,
  }
}

const toOperationalOnlineProductDetail = (p) => {
  if (!p) return null

  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)
  const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

  return {
    id: p.id,
    name: p.name,
    mode: p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED'),
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    imageUrl,
    priceOnline: Number(bp?.priceOnline ?? 0),
    priceOnlineEffective: bp && bp.isActive === false ? null : Number(bp?.priceOnline ?? 0),
    readyPickupAtBranch: isReady,
    isReady,
    hasPrice: !!bp,
    branchPriceActive: bp?.isActive ?? true,
  }
}

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
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  if (!ptId || !brId) return

  try {
    await db.productTypeBrand.create({ data: { productTypeId: ptId, brandId: brId } })
  } catch (error) {
    if (error?.code === 'P2002') return
    console.warn('autoLearnProductTypeBrand failed:', error?.message || error)
  }
}

const fetchOperationalRuntimeProduct = (productId, branchId, db = prisma) => (
  db.product.findFirst({
    where: { id: Number(productId), active: true, productType: { branchId: Number(branchId) } },
    select: selectOperationalRuntimeProduct(Number(branchId)),
  })
)

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

  const result = await db.$transaction(async (tx) => {
    const productType = await tx.productType.findFirst({
      where: { id: productTypeId, branchId: brId },
      select: { id: true, globalProductType: { select: { categoryId: true } } },
    })

    if (!productType) {
      const error = new Error('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH')
      error.statusCode = 400
      error.status = 400
      error.code = 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
      throw error
    }

    const { mode, noSN, trackSerialNumber } = decideLocalMode({
      explicitMode: data.mode ?? data.stockMode ?? data.stockBehavior,
      noSN: data.noSN,
      trackSerialNumber: data.trackSerialNumber,
    })

    const product = await tx.product.create({
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
      select: { id: true },
    })

    await tx.branchPrice.upsert({
      where: { productId_branchId: { productId: product.id, branchId: brId } },
      update: {
        costPrice,
        priceRetail,
        priceWholesale: toNum(pricePayload.priceWholesale),
        priceTechnician: toNum(pricePayload.priceTechnician),
        priceOnline: toNum(pricePayload.priceOnline),
        isActive: typeof pricePayload.isActive === 'boolean' ? pricePayload.isActive : true,
      },
      create: {
        productId: product.id,
        branchId: brId,
        costPrice,
        priceRetail,
        priceWholesale: toNum(pricePayload.priceWholesale),
        priceTechnician: toNum(pricePayload.priceTechnician),
        priceOnline: toNum(pricePayload.priceOnline),
        isActive: typeof pricePayload.isActive === 'boolean' ? pricePayload.isActive : true,
      },
    })

    await autoLearnProductTypeBrand(tx, productType.id, data.brandId)

    return fetchOperationalRuntimeProduct(product.id, brId, tx)
  }, { timeout: 15000 })

  const mapped = toOperationalRuntimeProduct(result, brId)

  return {
    success: true,
    created: true,
    data: mapped,
    product: mapped,
    branchId: brId,
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

  const product = await db.product.findFirst({
    where: {
      active: true,
      templateProductId: tplId,
      productType: { branchId: brId },
    },
    select: selectOperationalRuntimeProduct(brId),
    orderBy: { id: 'desc' },
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

  const product = await db.product.findFirst({
    where: {
      id,
      productType: { branchId: brId },
    },
    select: selectOperationalProductDetail(brId),
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

  const items = await db.product.findMany({
    where: { AND: whereAND },
    select: selectOperationalRuntimeProduct(brId),
    take: takeNum,
    skip: skipNum,
    orderBy: { id: 'desc' },
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

  const items = await db.product.findMany({
    where: whereAND.length ? { AND: whereAND } : {},
    select: selectOperationalOnlineProduct(brId),
    take: takeNum,
    skip: skipNum,
    orderBy: { id: 'desc' },
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

  const product = await db.product.findFirst({
    where: {
      id,
      productType: { branchId: brId },
    },
    select: selectOperationalOnlineProduct(brId),
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

  return db.stockItem.findFirst({
    where: {
      branchId: brId,
      barcode: code,
      product: { productType: { branchId: brId } },
    },
    include: { product: true },
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

  return db.stockItem.findFirst({
    where: {
      branchId: brId,
      serialNumber: serial,
      product: { productType: { branchId: brId } },
    },
    include: { product: true },
  })
}

module.exports = {
  createLocalOperationalProduct,
  findOperationalProductById,
  findOperationalProductByTemplateId,
  findOperationalProducts,
  findOperationalProductsForPOS,
  findOperationalProductsForOnline,
  findOperationalProductOnlineById,
  findOperationalProductByBarcode,
  findOperationalProductBySerial,
  selectOperationalRuntimeProduct,
  toOperationalRuntimeProduct,
}
