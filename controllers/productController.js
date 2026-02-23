


// ✅ server/controllers/productController.js (Production Standard)
// CommonJS only; all endpoints wrapped in try/catch; branch scope is enforced where required.
// Product hierarchy (latest baseline):
// Category -> ProductType -> Product -> (optional) Brand / ProductProfile / ProductTemplate

const { prisma, Prisma } = require('../lib/prisma')

// cloudinary is optional in dev; guard to avoid crash if module missing
let cloudinary = null
try {
  cloudinary = require('../lib/cloudinary')
} catch (_e) {
  cloudinary = null
}

// ---------- Helpers ----------
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number.parseInt(v, 10))
const normStr = (s) => (s == null ? '' : String(s)).trim()
// Decimal normalizers to avoid Prisma decimal parsing errors on empty strings
const toDec = (v, fallback = 0) => (v === '' || v === null || v === undefined ? fallback : Number(v))
const toDecUndef = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))

const decideMode = ({ explicitMode, noSN, trackSerialNumber }) => {
  const exp = explicitMode ? String(explicitMode).toUpperCase() : undefined
  const n = noSN === true || noSN === 'true' || noSN === 1 || noSN === '1'
  const t = trackSerialNumber === true || trackSerialNumber === 'true' || trackSerialNumber === 1 || trackSerialNumber === '1'

  if (exp === 'SIMPLE') return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  if (exp === 'STRUCTURED') return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  if (t && !n) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  if (n && !t) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  if (t && n) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
}

const assertTypeAndCategory = async ({ productTypeId, categoryId }, db = prisma) => {
  // productTypeId is required for Product in the new hierarchy
  if (!productTypeId) {
    return { ok: false, error: 'PRODUCT_TYPE_REQUIRED' }
  }

    const t = await db.productType.findUnique({
    where: { id: Number(productTypeId) },
    select: { id: true, categoryId: true },
  })

  if (!t) return { ok: false, error: 'PRODUCT_TYPE_NOT_FOUND' }

  if (categoryId && Number(categoryId) !== Number(t.categoryId)) {
    return { ok: false, error: 'CATEGORY_TYPE_MISMATCH' }
  }

  return { ok: true, productTypeId: Number(t.id), categoryId: Number(t.categoryId) }
}

const assertProfileMatchesType = async ({ productProfileId, productTypeId }, db = prisma) => {
  // NOTE:
  // Current Prisma schema: ProductProfile has NO productTypeId field.
  // So we can only validate existence here (production-safe).
  if (productProfileId === undefined) return { ok: true, productProfileId: undefined }
  if (productProfileId === null) return { ok: true, productProfileId: null }

    const p = await db.productProfile.findUnique({
    where: { id: Number(productProfileId) },
    select: { id: true },
  })

  if (!p) return { ok: false, error: 'PRODUCT_PROFILE_NOT_FOUND' }

  return { ok: true, productProfileId: Number(p.id) }
}


const assertTemplateMatchesType = async ({ templateId, productTypeId }, db = prisma) => {
  // NOTE:
  // ProductTemplate has productProfileId, but ProductProfile has NO productTypeId.
  // So we only validate template existence and return productProfileId for optional auto-fill.
  if (templateId === undefined) return { ok: true, templateId: undefined, productProfileIdFromTemplate: undefined }
  if (templateId === null) return { ok: true, templateId: null, productProfileIdFromTemplate: null }

    const tpl = await db.productTemplate.findUnique({
    where: { id: Number(templateId) },
    select: { id: true, productProfileId: true },
  })

  if (!tpl) return { ok: false, error: 'PRODUCT_TEMPLATE_NOT_FOUND' }

  return {
    ok: true,
    templateId: Number(tpl.id),
    productProfileIdFromTemplate: tpl.productProfileId ? Number(tpl.productProfileId) : null,
  }
}


const createOrRepairStockBalance = async (tx, productId, branchId) => {
  if (!tx || !productId || !branchId) return
  let qty = 0
  try {
    qty = await tx.stockItem.count({
      where: { productId: Number(productId), branchId: Number(branchId), status: 'IN_STOCK' },
    })
  } catch (_e) {
    console.warn('createOrRepairStockBalance: count stockItem failed → default 0')
    qty = 0
  }

  await tx.stockBalance.upsert({
    where: { productId_branchId: { productId: Number(productId), branchId: Number(branchId) } },
    update: { quantity: qty },
    create: { productId: Number(productId), branchId: Number(branchId), quantity: qty, reserved: 0 },
  })
}

// =====================================================
// GET: /api/products (admin list)
// =====================================================
const getAllProducts = async (req, res) => {
  const {
    search = '',
    take = 100,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    productTemplateId,
    templateId, // alias
    brandId,
    activeOnly = 'true',
    includeInactive = '0',
  } = req.query

  const takeNum = Math.max(1, Math.min(toInt(take) ?? 100, 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  const tplId = toInt(templateId ?? productTemplateId)
  const brId = toInt(brandId)

  const wantIncludeInactive = String(includeInactive) === '1' || String(includeInactive).toLowerCase() === 'true'
  const wantActiveOnlyFalse = String(activeOnly).toLowerCase() === 'false'
  const activeFilter = (wantIncludeInactive || wantActiveOnlyFalse) ? undefined : true

  try {
    const whereAND = []

    if (activeFilter !== undefined) whereAND.push({ active: activeFilter })

    if (search) {
      whereAND.push({
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
        ],
      })
    }

    const catId = toInt(categoryId)
    const typeId = toInt(productTypeId)
    const profId = toInt(productProfileId)

    if (catId) {
      const typeIds = await prisma.productType
        .findMany({ where: { categoryId: catId }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id))

      // ✅ ยึดโครงสร้างใหม่: type เป็นตัวจริงของ hierarchy
      whereAND.push({
        OR: [
          { productTypeId: { in: typeIds.length ? typeIds : [-1] } },
          // legacy/helper: เผื่อมี categoryId บน product (optional)
          { categoryId: catId },
        ],
      })
    }

    if (typeId) whereAND.push({ productTypeId: typeId })

    if (profId) {
      whereAND.push({
        OR: [
          { productProfileId: profId },
          { template: { is: { productProfileId: profId } } },
        ],
      })
    }

    if (tplId) whereAND.push({ templateId: tplId })
    if (brId) whereAND.push({ brandId: brId })

    const where = whereAND.length ? { AND: whereAND } : {}

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        mode: true,
        active: true,

        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,

        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true } },
        template: {
          select: {
            id: true,
            name: true,
            productProfile: { select: { id: true, name: true } },
          },
        },

        // ✅ Brand (optional)
        brandId: true,
        brand: { select: { id: true, name: true, active: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    })

    const mapped = products.map((p) => {
      const catName = p.productType?.category?.name ?? p.category?.name ?? '-'
      const typeName = p.productType?.name ?? '-'
      const profileName = p.productProfile?.name ?? p.template?.productProfile?.name ?? '-'
      const tplName = p.template?.name ?? '-'

      return {
        id: p.id,
        name: p.name,
        mode: p.mode,
        active: (typeof p.active === 'boolean' ? p.active : true),
        spec: null,

        categoryId: (p.productType?.category?.id ?? p.categoryId ?? null),
        productTypeId: (p.productTypeId ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),

        category: catName,
        productType: typeName,
        productProfile: profileName,
        productTemplate: tplName,

        categoryName: catName,
        productTypeName: typeName,
        productProfileName: profileName,
        productTemplateName: tplName,

        // ✅ Brand (optional)
        // NOTE (production rule): brandName ต้องมาจาก Brand เท่านั้น (ไม่ fallback ไปที่ Profile/Template)
        brandId: p.brandId ?? p.brand?.id ?? null,
        brandName: (p.brand?.name ?? null),

        imageUrl: null,
      }
    })

    return res.json(mapped)
  } catch (error) {
    console.error('❌ getAllProducts error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// =====================================================
// GET: /api/products/pos/search
// =====================================================
const getProductsForPos = async (req, res) => {
  const branchId = Number(req.user?.branchId)
  if (!branchId) return res.status(401).json({ error: 'unauthorized' })

  const {
    search = '',
    take = 50,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    brandId,
    templateId,
    productTemplateId,
    readyOnly = 'false',
    hasPrice = 'false',
    activeOnly = 'true',
    includeInactive = '0',
  } = req.query

  const queryMode = (req?.query?.mode || '').toString().toUpperCase()
  const simpleOnly = req?.query?.simpleOnly === '1' || queryMode === 'SIMPLE'

  const takeNum = Math.max(1, Math.min(toInt(take) ?? 50, 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))

  const wantIncludeInactive = String(includeInactive) === '1' || String(includeInactive).toLowerCase() === 'true'
  const wantActiveOnlyFalse = String(activeOnly).toLowerCase() === 'false'
  const activeFilter = (wantIncludeInactive || wantActiveOnlyFalse) ? undefined : true

  const tplId = toInt(templateId ?? productTemplateId)

  const whereAND = []
  if (simpleOnly) whereAND.push({ mode: 'SIMPLE' })
  if (activeFilter !== undefined) whereAND.push({ active: activeFilter })

  if (search) {
    whereAND.push({
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
        ],
      })
  }

  const catId = toInt(categoryId)
  const typeId = toInt(productTypeId)
  const profId = toInt(productProfileId)
  const tmplId = tplId
  const brId = toInt(brandId)

  try {
    if (catId) {
      const __catTypeIds = (await prisma.productType.findMany({
        where: { categoryId: catId },
        select: { id: true },
      })).map((x) => x.id)

      whereAND.push({
        OR: [
          { productTypeId: { in: __catTypeIds.length ? __catTypeIds : [-1] } },
          // legacy/helper
          { categoryId: catId },
        ],
      })
    }

    if (typeId) whereAND.push({ productTypeId: typeId })

    if (profId) {
      whereAND.push({
        OR: [
          { productProfileId: profId },
          { template: { is: { productProfileId: profId } } },
        ],
      })
    }

    if (tmplId) whereAND.push({ templateId: tmplId })
    if (brId) whereAND.push({ brandId: brId })

    const where = whereAND.length ? { AND: whereAND } : {}

    const items = await prisma.product.findMany({
      where,
      select: {
        id: true,
        active: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,

        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,

        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true } },
        template: {
          select: {
            id: true,
            name: true,
            productProfile: { select: { id: true, name: true } },
          },
        },

        // ✅ Brand (optional)
        brandId: true,
        brand: { select: { id: true, name: true, active: true } },

        branchPrice: {
          where: { branchId },
          take: 1,
          select: {
            costPrice: true,
            priceRetail: true,
            priceOnline: true,
            priceWholesale: true,
            priceTechnician: true,
            isActive: true,
          },
        },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true, lastReceivedCost: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    })

    const uniqueItems = (() => {
      const map = new Map()
      for (const p of items) {
        const key = p?.id
        if (!key) continue
        if (!map.has(key)) map.set(key, p)
      }
      return Array.from(map.values())
    })()

    const mappedBase = uniqueItems.map((p) => {
      const bp = p.branchPrice?.[0]
      const sb = p.stockBalances?.[0]
      const qty = Number(sb?.quantity ?? 0)
      const reserved = Number(sb?.reserved ?? 0)
      const available = Math.max(0, qty - reserved)
      const isSimple = p.mode === 'SIMPLE' || p.noSN === true
      const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0)

      const lastCost = sb?.lastReceivedCost != null
        ? Number(sb.lastReceivedCost)
        : (bp?.costPrice != null ? Number(bp.costPrice) : null)

      const catName = p.productType?.category?.name ?? p.category?.name ?? '-'
      const typeName = p.productType?.name ?? '-'
      const profileName = p.productProfile?.name ?? p.template?.productProfile?.name ?? '-'
      const tplName = p.template?.name ?? '-'

      return {
        id: p.id,
        active: (typeof p.active === 'boolean' ? p.active : true),
        name: p.name,

        mode: p.mode,
        categoryId: (p.productType?.category?.id ?? p.categoryId ?? null),
        productTypeId: (p.productTypeId ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),

        category: catName,
        productType: typeName,
        productProfile: profileName,
        productTemplate: tplName,

        categoryName: catName,
        productTypeName: typeName,
        productProfileName: profileName,
        productTemplateName: tplName,

        // ✅ Brand (optional)
        // NOTE (production rule): brandName ต้องมาจาก Brand เท่านั้น (ไม่ fallback ไปที่ Profile/Template)
        brandId: p.brandId ?? p.brand?.id ?? null,
        brandName: (p.brand?.name ?? null),

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
    })

    let mapped = mappedBase

    if (String(readyOnly).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.isReady === true)
    }
    if (String(hasPrice).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.hasPrice === true && x.branchPriceActive !== false)
    }

    return res.json(mapped)
  } catch (error) {
    console.error('❌ getProductsForPos error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// =====================================================
// GET: /api/products/online
// =====================================================
const getProductsForOnline = async (req, res) => {
  const branchId = Number(req.user?.branchId) || toInt(req.query.branchId)
  if (!branchId) return res.status(400).json({ error: 'BRANCH_REQUIRED' })

  const {
    search: q1 = '',
    searchText: q2 = '',
    take = 50,
    size,
    page = 1,
    categoryId,
    productTypeId,
    productProfileId,
    productTemplateId,
    templateId,
    brandId,
    activeOnly = 'true',
    readyOnly = 'false',
    hasPrice = 'false',
  } = req.query

  const queryMode = (req?.query?.mode || '').toString().toUpperCase()
  const simpleOnly = req?.query?.simpleOnly === '1' || queryMode === 'SIMPLE'

  const search = normStr(q1 || q2)
  const takeNum = Math.max(1, Math.min((toInt(size) ?? toInt(take) ?? 50), 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  const activeFilter = (String(activeOnly).toLowerCase() === 'false') ? undefined : true
  const tplId = toInt(templateId ?? productTemplateId)

  try {
    const whereAND = []
    if (activeFilter !== undefined) whereAND.push({ active: true })
    if (simpleOnly) whereAND.push({ mode: 'SIMPLE' })

    if (search) {
      whereAND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    const catId = toInt(categoryId)
    const typeId = toInt(productTypeId)
    const profId = toInt(productProfileId)
    const tmplId = tplId
    const brId = toInt(brandId)

    if (catId) {
      const __catTypeIds = (await prisma.productType.findMany({
        where: { categoryId: catId },
        select: { id: true },
      })).map((x) => x.id)

      whereAND.push({
        OR: [
          { productTypeId: { in: __catTypeIds.length ? __catTypeIds : [-1] } },
          // legacy/helper
          { categoryId: catId },
        ],
      })
    }

    if (typeId) whereAND.push({ productTypeId: typeId })

    if (profId) {
      whereAND.push({
        OR: [
          { productProfileId: profId },
          { template: { is: { productProfileId: profId } } },
        ],
      })
    }

    if (tmplId) whereAND.push({ templateId: tmplId })
    if (brId) whereAND.push({ brandId: brId })

    const where = whereAND.length ? { AND: whereAND } : {}

    const items = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,
        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, productProfile: { select: { id: true, name: true } } } },
        productImages: { where: { isCover: true, active: true }, take: 1, select: { secure_url: true, url: true } },
        branchPrice: { where: { branchId }, take: 1, select: { priceOnline: true, isActive: true } },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    })

    let mapped = items.map((p) => {
      const bp = p.branchPrice?.[0]
      const sb = p.stockBalances?.[0]
      const qty = Number(sb?.quantity ?? 0)
      const reserved = Number(sb?.reserved ?? 0)
      const available = Math.max(0, qty - reserved)
      const isSimple = (p.mode === 'SIMPLE') || (p.noSN === true)
      const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0)

      const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

      return {
        id: p.id,
        name: p.name,
        mode: p.mode,
        categoryId: (p.productType?.category?.id ?? p.categoryId ?? null),
        productTypeId: (p.productTypeId ?? null),
        productProfileId: (p.productProfileId ?? p.template?.productProfile?.id ?? null),
        templateId: (p.templateId ?? p.template?.id ?? null),
        productTemplateId: (p.templateId ?? p.template?.id ?? null),
        imageUrl,
        priceOnline: Number(bp?.priceOnline ?? 0),
        readyPickupAtBranch: isReady,
        isReady,
        category: p.productType?.category?.name ?? p.category?.name ?? undefined,
        productType: p.productType?.name ?? undefined,
        productProfile: p.productProfile?.name ?? p.template?.productProfile?.name ?? undefined,
        productTemplate: p.template?.name ?? undefined,
        hasPrice: !!bp,
        branchPriceActive: bp?.isActive ?? true,
      }
    })

    if (String(readyOnly).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.isReady === true)
    }
    if (String(hasPrice).toLowerCase() === 'true') {
      mapped = mapped.filter((x) => x.hasPrice === true && x.branchPriceActive !== false)
    }

    return res.json(mapped)
  } catch (error) {
    console.error('❌ getProductsForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// =====================================================
// GET: /api/products/pos/:id
// =====================================================
const getProductPosById = async (req, res) => {
  const branchId = Number(req.user?.branchId)
  if (!branchId) return res.status(401).json({ error: 'unauthorized' })

  const id = toInt(req.params.id)
  if (!id) return res.status(400).json({ error: 'INVALID_ID' })

  try {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,

        categoryId: true,
        productTypeId: true,
        productProfileId: true,
        templateId: true,

        productType: { select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true } } } },
        productProfile: { select: { id: true, name: true } },
        template: {
          select: {
            id: true,
            name: true,
            productProfileId: true,
            productProfile: { select: { id: true, name: true } },
          },
        },

        // ✅ Brand (optional)
        brandId: true,
        brand: { select: { id: true, name: true, active: true } },

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

        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true, lastReceivedCost: true } },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
      },
    })

    if (!p) return res.status(404).json({ error: 'NOT_FOUND' })

    const bp = p.branchPrice?.[0]
    const sb = p.stockBalances?.[0]
    const qty = Number(sb?.quantity ?? 0)
    const reserved = Number(sb?.reserved ?? 0)
    const available = Math.max(0, qty - reserved)
    const isSimple = (p.mode === 'SIMPLE') || (p.noSN === true)
    const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0)

    const lastCost = sb?.lastReceivedCost != null
      ? Number(sb.lastReceivedCost)
      : (bp?.costPrice != null ? Number(bp.costPrice) : null)

    const mode = p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED')

    const catName = p.productType?.category?.name ?? p.category?.name ?? null
    const typeName = p.productType?.name ?? null
    const profileName = p.productProfile?.name ?? p.template?.productProfile?.name ?? null
    const tplName = p.template?.name ?? null

    const branchPriceObj = {
      costPrice: Number(bp?.costPrice ?? 0),
      priceWholesale: Number(bp?.priceWholesale ?? 0),
      priceTechnician: Number(bp?.priceTechnician ?? 0),
      priceRetail: Number(bp?.priceRetail ?? 0),
      priceOnline: Number(bp?.priceOnline ?? 0),
    }

    return res.json({
      id: p.id,
      name: p.name,
      spec: null,

      mode,
      noSN: p.noSN,
      trackSerialNumber: p.trackSerialNumber,
      unitId: null,
      unitName: null,

      categoryId: (p.productType?.categoryId ?? p.categoryId ?? null),
      productTypeId: p.productTypeId ?? null,
      productProfileId: p.productProfile?.id ?? p.template?.productProfile?.id ?? p.productProfileId ?? null,
      templateId: p.templateId ?? p.template?.id ?? null,
      productTemplateId: p.templateId ?? p.template?.id ?? null,

      categoryName: catName,
      productTypeName: typeName,
      productProfileName: profileName,
      productTemplateName: tplName,

      // ✅ Brand (optional)
      // NOTE (production rule): brandName ต้องมาจาก Brand เท่านั้น (ไม่ fallback ไปที่ Profile/Template)
      brandId: p.brandId ?? p.brand?.id ?? null,
      brandName: (p.brand?.name ?? null),

      images: (p.productImages || [])
        .map((im) => ({ id: im.id, url: im.secure_url || im.url, caption: im.caption ?? '', isCover: Boolean(im.isCover) }))
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
    })
  } catch (error) {
    console.error('❌ getProductPosById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ✅ Online product detail (public)
const getProductOnlineById = async (req, res) => {
  const branchId = toInt(req.query.branchId) ?? Number(req.user?.branchId)
  if (!branchId) return res.status(400).json({ error: 'BRANCH_REQUIRED' })

  const id = toInt(req.params.id)
  if (!id) return res.status(400).json({ error: 'INVALID_ID' })

  try {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        productImages: { where: { isCover: true, active: true }, take: 1, select: { secure_url: true, url: true } },
        branchPrice: { where: { branchId }, take: 1, select: { priceOnline: true, isActive: true } },
        stockItems: { where: { branchId, status: 'IN_STOCK' }, select: { id: true }, take: 1 },
        stockBalances: { where: { branchId }, take: 1, select: { quantity: true, reserved: true } },
      },
    })

    if (!p) return res.status(404).json({ error: 'NOT_FOUND' })

    const bp = p.branchPrice?.[0]
    const sb = p.stockBalances?.[0]
    const qty = Number(sb?.quantity ?? 0)
    const reserved = Number(sb?.reserved ?? 0)
    const available = Math.max(0, qty - reserved)
    const isSimple = (p.mode === 'SIMPLE') || (p.noSN === true)
    const isReady = isSimple ? available > 0 : ((p.stockItems?.length ?? 0) > 0)

    const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

    return res.json({
      id: p.id,
      name: p.name,
      mode: p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED'),
      imageUrl,
      priceOnline: Number(bp?.priceOnline ?? 0),
      readyPickupAtBranch: isReady,
      isReady,
      hasPrice: !!bp,
      branchPriceActive: bp?.isActive ?? true,
    })
  } catch (error) {
    console.error('❌ getProductOnlineById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// =====================================================
// GET: /api/products/dropdowns (auth) + /api/products/online/dropdowns (public)
// - No branch scope required. (All are GLOBAL lists)
// =====================================================
const getProductDropdowns = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive ?? 'false').toLowerCase() === 'true'

    const [cats, types, profiles, templatesRaw, brandsRaw] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.productType.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, categoryId: true } }),
      prisma.productProfile.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),

      prisma.productTemplate.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, productProfileId: true } }),

      // ✅ Brands are GLOBAL (ข้อมูลกลาง ใช้ทุกสาขา)
      prisma.brand.findMany({
        where: {
          ...(includeInactive ? {} : { active: true }),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, active: true },
      }),
    ])

    const categories = cats.map((c) => ({ id: Number(c.id), name: c.name }))
    const productTypes = types.map((t) => ({ id: Number(t.id), name: t.name, categoryId: Number(t.categoryId) }))
    const productProfiles = profiles.map((p) => ({ id: Number(p.id), name: p.name }))

        const productTemplates = templatesRaw.map((tp) => ({
      id: Number(tp.id),
      name: tp.name,
      productProfileId: (tp.productProfileId == null ? null : Number(tp.productProfileId)),
    }))
    const brands = (brandsRaw || []).map((b) => ({ id: Number(b.id), name: b.name, active: !!b.active }))

    const productModes = [
      { code: 'SIMPLE', name: 'Simple' },
      { code: 'STRUCTURED', name: 'Structure' },
    ]

    return res.json({
      categories,
      productTypes,
      productProfiles,
      productTemplates,
      brands,
      productModes,
      templates: productTemplates,
    })
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  }
}

// =====================================================
// POST: /api/products
// - Enforce new hierarchy: productTypeId required; categoryId derived from type
// - Brand/Profile/Template are optional
// =====================================================
const createProduct = async (req, res) => {
  try {
    const data = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const name = normStr(data.name)
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' })

    const { mode, noSN, trackSerialNumber } = decideMode({
      explicitMode: data.mode,
      noSN: data.noSN,
      trackSerialNumber: data.trackSerialNumber,
    })

    const bodyTypeId = toInt(data.productTypeId)
    const bodyCatId = toInt(data.categoryId)

    const typeCheck = await assertTypeAndCategory({ productTypeId: bodyTypeId, categoryId: bodyCatId })
    if (!typeCheck.ok) return res.status(400).json({ error: typeCheck.error })

    const bodyProfileId = (data.productProfileId === undefined) ? undefined : (data.productProfileId === null ? null : toInt(data.productProfileId))
    const bodyTemplateId = (data.templateId ?? data.productTemplateId ?? data.templateId) // allow aliases
    const templateIdNum = (bodyTemplateId === undefined) ? undefined : (bodyTemplateId === null ? null : toInt(bodyTemplateId))

    // profile must match type when provided
    const profCheck = await assertProfileMatchesType({ productProfileId: bodyProfileId, productTypeId: typeCheck.productTypeId })
    if (!profCheck.ok) return res.status(400).json({ error: profCheck.error })

    // template must match type when provided
    const tplCheck = await assertTemplateMatchesType({ templateId: templateIdNum, productTypeId: typeCheck.productTypeId })
    if (!tplCheck.ok) return res.status(400).json({ error: tplCheck.error })

    // If template is provided, we can auto-fill profileId if not provided
    const finalProfileId = (
      profCheck.productProfileId !== undefined
        ? profCheck.productProfileId
        : (tplCheck.productProfileIdFromTemplate !== undefined ? tplCheck.productProfileIdFromTemplate : undefined)
    )

    const newProduct = await prisma.product.create({
      data: {
        name,
        mode,
        trackSerialNumber,
        noSN,
        active: (typeof data.active === 'boolean' ? data.active : true),

        // hierarchy enforced
        productTypeId: typeCheck.productTypeId,
        categoryId: typeCheck.categoryId,

        // optional extensions
        brandId: (data.brandId === null ? null : toInt(data.brandId)),
        productProfileId: finalProfileId,
        templateId: tplCheck.templateId,

        productImages: Array.isArray(data.images) && data.images.length > 0
          ? {
              create: data.images.map((img) => ({
                url: img.url,
                public_id: img.public_id,
                secure_url: img.secure_url,
                caption: img.caption || null,
                isCover: !!img.isCover,
                active: true,
              })),
            }
          : undefined,
      },
      select: { id: true },
    })

    const bp = data.branchPrice || {}
    await prisma.branchPrice.upsert({
      where: { productId_branchId: { productId: newProduct.id, branchId } },
      update: {
        costPrice: toDecUndef(bp.costPrice),
        priceWholesale: toDecUndef(bp.priceWholesale),
        priceTechnician: toDecUndef(bp.priceTechnician),
        priceRetail: toDecUndef(bp.priceRetail),
        priceOnline: toDecUndef(bp.priceOnline),
        isActive: (typeof bp.isActive === 'boolean' ? bp.isActive : undefined),
      },
      create: {
        productId: newProduct.id,
        branchId,
        costPrice: toDec(bp.costPrice, 0),
        priceWholesale: toDec(bp.priceWholesale, 0),
        priceTechnician: toDec(bp.priceTechnician, 0),
        priceRetail: toDec(bp.priceRetail, 0),
        priceOnline: toDec(bp.priceOnline, 0),
        isActive: (typeof bp.isActive === 'boolean' ? bp.isActive : true),
      },
    })

    return res.status(201).json({ id: newProduct.id })
  } catch (error) {
    console.error('❌ createProduct error:', error)
    return res.status(error.status || 500).json({ error: error.code || error.message || 'Failed to create product' })
  }
}

// =====================================================
// PUT/PATCH: /api/products/:id
// - Enforce new hierarchy: productTypeId required when changing
// - Category derived from type; if categoryId passed must match type
// - Brand/Profile/Template optional and can be cleared
// =====================================================
const updateProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    const data = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

        // Only override mode/noSN/trackSerialNumber when client explicitly sends any of them
    const shouldOverrideMode =
      data.mode !== undefined || data.noSN !== undefined || data.trackSerialNumber !== undefined

    const partialMode = shouldOverrideMode
      ? decideMode({
          explicitMode: data.mode,
          noSN: data.noSN,
          trackSerialNumber: data.trackSerialNumber,
        })
      : null

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id },
        select: { id: true, productTypeId: true, categoryId: true },
      })
      if (!current) throw Object.assign(new Error('NOT_FOUND'), { status: 404, code: 'NOT_FOUND' })

      const incomingTypeId = (data.productTypeId === undefined) ? undefined : toInt(data.productTypeId)
      const incomingCatId = (data.categoryId === undefined) ? undefined : toInt(data.categoryId)

      // If productTypeId is being changed, validate against category.
      // If not being changed, still validate incoming categoryId (if provided) matches existing type category.
      const effectiveTypeId = incomingTypeId ?? current.productTypeId

            const typeCheck = await assertTypeAndCategory({
        productTypeId: effectiveTypeId,
        categoryId: (incomingCatId ?? undefined),
      }, tx)
      if (!typeCheck.ok) throw Object.assign(new Error(typeCheck.error), { status: 400, code: typeCheck.error })

      const incomingProfileId = (data.productProfileId === undefined)
        ? undefined
        : (data.productProfileId === null ? null : toInt(data.productProfileId))

      const incomingTemplateIdRaw = (data.templateId ?? data.productTemplateId)
      const incomingTemplateId = (incomingTemplateIdRaw === undefined)
        ? undefined
        : (incomingTemplateIdRaw === null ? null : toInt(incomingTemplateIdRaw))

            const profCheck = await assertProfileMatchesType({ productProfileId: incomingProfileId, productTypeId: typeCheck.productTypeId }, tx)
      if (!profCheck.ok) throw Object.assign(new Error(profCheck.error), { status: 400, code: profCheck.error })

            const tplCheck = await assertTemplateMatchesType({ templateId: incomingTemplateId, productTypeId: typeCheck.productTypeId }, tx)
      if (!tplCheck.ok) throw Object.assign(new Error(tplCheck.error), { status: 400, code: tplCheck.error })

      // If template is provided and profile is not explicitly provided, auto-fill profile from template.
      const finalProfileId = (incomingProfileId !== undefined)
        ? incomingProfileId
        : (tplCheck.productProfileIdFromTemplate !== undefined ? tplCheck.productProfileIdFromTemplate : undefined)

      const saved = await tx.product.update({
        where: { id },
        data: {
          name: data.name != null ? normStr(data.name) : undefined,
          ...(partialMode
            ? {
                mode: partialMode.mode,
                trackSerialNumber: partialMode.trackSerialNumber,
                noSN: partialMode.noSN,
              }
            : {}),
          active: typeof data.active === 'boolean' ? data.active : undefined,

          // hierarchy
          productTypeId: (incomingTypeId !== undefined ? typeCheck.productTypeId : undefined),
          categoryId: (incomingTypeId !== undefined ? typeCheck.categoryId : undefined),

          // optional extensions
          brandId: (data.brandId === undefined || data.brandId === '')
            ? undefined
            : (data.brandId === null ? null : toInt(data.brandId)),

          productProfileId: finalProfileId,
          templateId: tplCheck.templateId,
        },
        select: { id: true },
      })

      if (data.branchPrice) {
        const bp = data.branchPrice || {}
        await tx.branchPrice.upsert({
          where: { productId_branchId: { productId: id, branchId } },
          update: {
            costPrice: toDecUndef(bp.costPrice),
            priceWholesale: toDecUndef(bp.priceWholesale),
            priceTechnician: toDecUndef(bp.priceTechnician),
            priceRetail: toDecUndef(bp.priceRetail),
            priceOnline: toDecUndef(bp.priceOnline),
            isActive: typeof bp.isActive === 'boolean' ? bp.isActive : undefined,
          },
          create: {
            productId: id,
            branchId,
            costPrice: toDec(bp.costPrice, 0),
            priceWholesale: toDec(bp.priceWholesale, 0),
            priceTechnician: toDec(bp.priceTechnician, 0),
            priceRetail: toDec(bp.priceRetail, 0),
            priceOnline: toDec(bp.priceOnline, 0),
            isActive: typeof bp.isActive === 'boolean' ? bp.isActive : true,
          },
        })
      }

      if (partialMode && partialMode.mode === 'SIMPLE') {
        try {
          await createOrRepairStockBalance(tx, id, branchId)
        } catch (e) {
          console.warn('⚠️ createOrRepairStockBalance failed (non-fatal):', e?.message || e)
        }
      }

      return saved
    }, { timeout: 15000 })

    return res.json(result)
  } catch (error) {
    console.error('❌ updateProduct error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_CONSTRAINT' })
      if (error.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' })
    }
    if (error?.status) return res.status(error.status).json({ error: error.code || error.message || 'ERROR' })
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const disableProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const result = await prisma.product.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    })

    return res.json({ success: true, id: result.id, active: result.active, disabled: true })
  } catch (error) {
    console.error('❌ disableProduct error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const deleteProduct = disableProduct

const enableProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const result = await prisma.product.update({
      where: { id },
      data: { active: true },
      select: { id: true, active: true },
    })

    return res.json({ success: true, id: result.id, active: result.active, enabled: true })
  } catch (error) {
    console.error('❌ enableProduct error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const deleteProductImage = async (req, res) => {
  try {
    const productId = toInt(req.params.id)
    const { public_id } = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })
    if (!productId || !public_id) return res.status(400).json({ error: 'INVALID_PARAMS' })

    if (cloudinary?.uploader?.destroy) {
      try {
        await cloudinary.uploader.destroy(public_id)
      } catch (e) {
        console.warn('⚠️ cloudinary destroy failed:', e?.message || e)
      }
    }

    await prisma.productImage.updateMany({ where: { productId, public_id }, data: { active: false, isCover: false } })

    return res.json({ success: true })
  } catch (error) {
    console.error('❌ deleteProductImage error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// NOTE: this endpoint is legacy/ops tool; we only make it safe (no invalid StockStatus)
const migrateSnToSimple = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, mode: true } })
    if (!product) return res.status(404).json({ error: 'NOT_FOUND' })
    if (product.mode === 'SIMPLE') return res.status(409).json({ error: 'ALREADY_SIMPLE' })

    const groups = await prisma.stockItem.groupBy({
      by: ['branchId'],
      where: { productId: id, status: 'IN_STOCK' },
      _count: { _all: true },
    })

    let migratedQty = 0

    await prisma.$transaction(async (tx) => {
      for (const g of groups) {
        const qty = g._count?._all ?? 0
        if (!qty) continue
        migratedQty += qty

        await tx.stockBalance.upsert({
          where: { productId_branchId: { productId: id, branchId: g.branchId } },
          update: { quantity: { increment: qty } },
          create: { productId: id, branchId: g.branchId, quantity: qty, reserved: 0 },
        })

        // ✅ keep StockStatus valid: move SN out of IN_STOCK; use USED as neutral historical bucket
        await tx.stockItem.updateMany({
          where: { productId: id, branchId: g.branchId, status: 'IN_STOCK' },
          data: { status: 'USED' },
        })
      }

      await tx.product.update({
        where: { id },
        data: { mode: 'SIMPLE', noSN: true, trackSerialNumber: false },
      })
    })

    return res.json({ success: true, migratedQty, branches: groups.length })
  } catch (error) {
    console.error('❌ migrateSnToSimple error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductPosById,

  disableProduct,
  enableProduct,
  deleteProduct,

  deleteProductImage,
  getProductDropdowns,
  getProductsForOnline,
  getProductOnlineById,
  getProductsForPos,
  migrateSnToSimple,
}






