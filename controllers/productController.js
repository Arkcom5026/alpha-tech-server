// ✅ server/controllers/productController.js (Production Standard)
// CommonJS only; all endpoints wrapped in try/catch; branch scope is enforced where required.
// Product hierarchy (latest baseline):
// Category -> GlobalProductType -> ProductType -> Product -> Brand

const { prisma, Prisma } = require('../lib/prisma')
const {
  findOperationalProductById,
  findOperationalProductByTemplateId,
  findOperationalProductsForPOS,
  findOperationalProductsForOnline,
  findOperationalProductOnlineById,
  getReadyToSell: getReadyToSellService,
  getReadyToSellStructuredDetails: getReadyToSellStructuredDetailsService,
} = require('../src/modules/product/services/operationalProductRuntimeService')

let cloudinary = null
try {
  cloudinary = require('../lib/cloudinary')
} catch (_e) {
  cloudinary = null
}

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number.parseInt(v, 10))
const normStr = (s) => (s == null ? '' : String(s)).trim()

const toNumSafeUndef = (v) => {
  if (v === '' || v === null || v === undefined) return undefined
  const s = (typeof v === 'string') ? v.trim().replace(/,/g, '') : v
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
const toDec = (v, fallback = 0) => {
  const n = toNumSafeUndef(v)
  return n === undefined ? fallback : n
}
const toDecUndef = (v) => toNumSafeUndef(v)

const pickBranchPricePayload = (data = {}) => {
  const d = (data && typeof data === 'object') ? data : {}
  const bp = (d.branchPrice && typeof d.branchPrice === 'object') ? d.branchPrice : {}

  const hasNested = (
    bp.costPrice !== undefined ||
    bp.priceWholesale !== undefined ||
    bp.priceTechnician !== undefined ||
    bp.priceRetail !== undefined ||
    bp.priceOnline !== undefined ||
    bp.isActive !== undefined
  )

  if (hasNested) return bp

  const flat = {
    costPrice: d.costPrice,
    priceWholesale: d.priceWholesale,
    priceTechnician: d.priceTechnician,
    priceRetail: d.priceRetail,
    priceOnline: d.priceOnline,
    isActive: (d.branchPriceActive ?? d.isActive),
  }

  const hasFlat = (
    flat.costPrice !== undefined ||
    flat.priceWholesale !== undefined ||
    flat.priceTechnician !== undefined ||
    flat.priceRetail !== undefined ||
    flat.priceOnline !== undefined ||
    flat.isActive !== undefined
  )

  return hasFlat ? flat : null
}

const autoLearnProductTypeBrand = async (db, productTypeId, brandId) => {
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  if (!ptId || !brId) return

  try {
    await db.productTypeBrand.create({
      data: { productTypeId: ptId, brandId: brId },
    })
  } catch (e) {
    if (e?.code === 'P2002') return
    console.warn('⚠️ autoLearnProductTypeBrand failed (non-fatal):', e?.message || e)
  }
}

const decideMode = ({ explicitMode, noSN, trackSerialNumber }) => {
  const rawMode = (explicitMode === undefined || explicitMode === null) ? '' : String(explicitMode).trim()
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

const assertTypeAndCategory = async ({ productTypeId, categoryId }, db = prisma) => {
  if (!productTypeId) {
    return { ok: false, error: 'PRODUCT_TYPE_REQUIRED' }
  }

  const t = await db.productType.findUnique({
    where: { id: Number(productTypeId) },
    select: { id: true, globalProductType: { select: { categoryId: true } } },
  })

  if (!t) return { ok: false, error: 'PRODUCT_TYPE_NOT_FOUND' }

  const derivedCategoryId = t.globalProductType?.categoryId ?? null;

  if (categoryId && Number(categoryId) !== Number(derivedCategoryId)) {
    return { ok: false, error: 'CATEGORY_TYPE_MISMATCH' }
  }

  return { ok: true, productTypeId: Number(t.id), categoryId: Number(derivedCategoryId) }
}


const assertOperationalTypeAndCategory = async ({ productTypeId, categoryId, branchId }, db = prisma) => {
  const ptId = toInt(productTypeId)
  const brId = toInt(branchId)

  if (!ptId) {
    return { ok: false, error: 'PRODUCT_TYPE_REQUIRED' }
  }

  if (!brId) {
    return { ok: false, error: 'BRANCH_ID_MISSING' }
  }

  const t = await db.productType.findFirst({
    where: {
      id: ptId,
      branchId: brId,
    },
    select: {
      id: true,
      branchId: true,
      globalProductType: {
        select: {
          categoryId: true,
        },
      },
    },
  })

  if (!t) return { ok: false, error: 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH' }

  const derivedCategoryId = t.globalProductType?.categoryId ?? null

  if (categoryId && Number(categoryId) !== Number(derivedCategoryId)) {
    return { ok: false, error: 'CATEGORY_TYPE_MISMATCH' }
  }

  return {
    ok: true,
    productTypeId: Number(t.id),
    categoryId: Number(derivedCategoryId),
    branchId: Number(t.branchId),
  }
}

const createOrRepairStockBalance = async (tx, productId, branchId) => {
  if (!tx || !productId || !branchId) return

  let qty = 0
  try {
    qty = await tx.stockItem.count({
      where: {
        productId: Number(productId),
        branchId: Number(branchId),
        status: 'IN_STOCK',
      },
    })
  } catch (_e) {
    qty = 0
  }

  await tx.stockBalance.upsert({
    where: {
      productId_branchId: { productId: Number(productId), branchId: Number(branchId) },
    },
    update: { quantity: qty },
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      quantity: qty,
      reserved: 0,
    },
  })
}

const safeCount = async (db, modelName, where) => {
  try {
    const m = db?.[modelName]
    if (!m || typeof m.count !== 'function') return 0
    const n = await m.count({ where })
    return Number.isFinite(Number(n)) ? Number(n) : null
  } catch (e) {
    return null
  }
}

const computeProductUsageCounts = async (db, productId) => {
  const id = Number(productId)
  if (!Number.isFinite(id)) return { ok: false, error: 'INVALID_ID' }

  const counts = {
    stockItems: await safeCount(db, 'stockItem', { productId: id }),
    purchaseOrderItems: await safeCount(db, 'purchaseOrderItem', { productId: id }),
    purchaseOrderReceiptItems: await safeCount(db, 'purchaseOrderReceiptItem', { productId: id }),
    saleItemSimple: await safeCount(db, 'saleItemSimple', { productId: id }),
    orderOnlineItems: await safeCount(db, 'orderOnlineItem', { productId: id }),
    cartItems: await safeCount(db, 'cartItem', { productId: id }),
    productOnOrders: await safeCount(db, 'productOnOrder', { productId: id }),
    stockMovements: await safeCount(db, 'stockMovement', { productId: id }),
    simpleLots: await safeCount(db, 'simpleLot', { productId: id }),
    branchPrices: await safeCount(db, 'branchPrice', { productId: id }),
    stockBalances: await safeCount(db, 'stockBalance', { productId: id }),
    productImages: await safeCount(db, 'productImage', { productId: id }),
  }

  const hasUnknown = Object.values(counts).some((v) => v === null)
  const hasUsage = Object.values(counts).some((v) => typeof v === 'number' && v > 0)
  const canHardDelete = !hasUnknown && !hasUsage

  return {
    ok: true,
    productId: id,
    canHardDelete,
    hasUnknown,
    hasUsage,
    counts,
  }
}


// ✅ FIXED: ปลดล็อกฟิลเตอร์ความปลอดภัยระดับตัวแปรสากล เพื่อให้ Localhost กวาดสินค้าขึ้นมาโชว์เปิดดร็อปดาวน์ให้ได้ก่อน
const getAllProducts = async (req, res) => {
  const branchId = Number(req.user?.branchId) || toInt(req.query?.branchId)
  if (!branchId) return res.status(400).json({ error: 'BRANCH_REQUIRED', message: 'ไม่พบข้อมูลสาขา' })

  const {
    search = '',
    take = 100,
    page = 1,
    categoryId,
    productTypeId,
    brandId,
  } = req.query

  const takeNum = Math.max(1, Math.min(toInt(take) ?? 100, 200))
  const skipNum = Math.max(0, (toInt(page) ? (toInt(page) - 1) * takeNum : 0))
  
  const brId = toInt(brandId)
  const typeId = toInt(productTypeId)
  const catId = toInt(categoryId)

  // 📝 LOG ตรวจสอบพารามิเตอร์และสแกนปริมาณข้อมูลในเครื่อง Localhost
  console.log('🔍 [getAllProducts] Incoming Query Params:', {
    branchId,
    search,
    categoryId: catId,
    productTypeId: typeId,
    brandId: brId,
    takeNum,
    skipNum
  });

  try {
    // Runtime Catalog Separation:
    // Product List must show Operational Product of current branch only.
    // Template Product is reserved for QuickStock search / clone source.
    const whereAND = [
      {
        productType: {
          branchId,
        },
      },
    ]

    // 1. ค้นหาชื่อสินค้าแบบ Insensitive Case
    if (search) {
      whereAND.push({
        OR: [{ name: { contains: String(search), mode: 'insensitive' } }],
      })
    }

    // 2. 📂 FIXED HIERARCHY: วิ่งผ่านสะพานสากล ProductType -> GlobalProductType -> Category ตาม Schema จริง
    if (catId) {
      whereAND.push({
        productType: {
          globalProductType: { categoryId: catId }
        }
      })
    }

    // 3. กรองตามประเภทหน้าร้านและแบรนด์สินค้า
    if (typeId) whereAND.push({ productTypeId: typeId })
    if (brId) whereAND.push({ brandId: brId })

    const where = whereAND.length ? { AND: whereAND } : {}

    console.log('📦 [getAllProducts] Prisma Where Object:', JSON.stringify(where, null, 2));

    // นับเฉพาะ Operational Product ของสาขาปัจจุบัน ไม่อ่าน Template Catalog
    const totalCountInDb = await prisma.product.count({ where });
    console.log(`📊 [getAllProducts] Operational products for branch ${branchId}: ${totalCountInDb} rows`);

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        mode: true,
        active: true,
        productTypeId: true,
        // สืบทอดหาคีย์และชื่อหมวดหมู่ผ่านชั้น GlobalProductType ขึ้นไปหา Category สากล
        productType: { 
          select: { 
            id: true, 
            name: true, 
            globalProductType: { 
              select: { 
                categoryId: true,
                category: { select: { id: true, name: true } } 
              } 
            } 
          } 
        },
        brandId: true,
        brand: { select: { id: true, name: true, active: true } },
        unitId: true,
        unit: { select: { id: true, name: true } },
      },
      take: takeNum,
      skip: skipNum,
      orderBy: { id: 'desc' },
    })

    console.log(`✨ [getAllProducts] Query returned ${products.length} rows from database`);

    const mapped = products.map((p) => {
      // ดึงข้อมูลผ่านตัวแปรลอจิกขากลางชุดใหม่
      const catName = p.productType?.globalProductType?.category?.name ?? '-'
      const typeName = p.productType?.name ?? '-'

      return {
        id: p.id,
        name: p.name,
        mode: p.mode,
        active: (typeof p.active === 'boolean' ? p.active : true),
        spec: null,
        
        // ผูกรหัสกลับคืนไปให้สอดคล้องกับสถาปัตยกรรมข้อมูลล่าสุด
        categoryId: p.productType?.globalProductType?.categoryId ?? null,
        productTypeId: p.productTypeId ?? null,
        productProfileId: null, // คลีนโมเดลกำพร้าทิ้ง
        templateId: null,       // คลีนโมเดลกำพร้าทิ้ง
        productTemplateId: null, // คลีนโมเดลกำพร้าทิ้ง

        category: catName,
        productType: typeName,
        productProfile: '-',
        productTemplate: '-',
        categoryName: catName,
        productTypeName: typeName,
        productProfileName: '-',
        productTemplateName: '-',

        brandId: p.brandId ?? p.brand?.id ?? null,
        brandName: p.brand?.name ?? null,
        unitId: p.unitId ?? p.unit?.id ?? null,
        unitName: p.unit?.name ?? null,
        unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
        imageUrl: null,
      }
    })

    return res.json(mapped)
  } catch (error) {
    console.error('❌ getAllProducts error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}



const getProductsForPos = async (req, res) => {
  try {
    const result = await findOperationalProductsForPOS({
      branchId: req.user?.branchId,
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      activeOnly: req.query.activeOnly,
      includeInactive: req.query.includeInactive,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })

    console.error('❌ getProductsForPos error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const mapRuntimeProductForPos = (p, branchId) => {
  if (!p) return null

  const bp = p.branchPrice?.[0] || null
  const sb = p.stockBalances?.[0] || null

  const qty = Number(sb?.quantity ?? 0)
  const reserved = Number(sb?.reserved ?? 0)
  const available = Math.max(0, qty - reserved)

  const cat = p.productType?.globalProductType?.category || null
  const typeName = p.productType?.name ?? '-'

  return {
    id: p.id,
    active: (typeof p.active === 'boolean' ? p.active : true),
    name: p.name,
    mode: p.mode,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,

    templateProductId: p.templateProductId,
    isTemplateProduct: false,
    isOperationalProduct: true,

    categoryId: cat?.id ?? null,
    categoryName: cat?.name ?? null,
    category: cat?.name ?? '-',

    productTypeId: p.productTypeId ?? null,
    productTypeName: typeName,
    productType: typeName,

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
    stockBalance: sb ? {
      quantity: qty,
      reserved,
      available,
      lastReceivedCost: sb.lastReceivedCost,
    } : null,

    branchPrice: bp ? [bp] : [],
  }
}

const getOperationalProductByTemplateId = async (req, res) => {
  try {
    const result = await findOperationalProductByTemplateId({
      branchId: req.user?.branchId,
      templateProductId: req.params.templateProductId || req.query.templateProductId,
    })
    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_ID_MISSING') {
      return res.status(401).json({ success:false,error:'BRANCH_ID_MISSING' })
    }
    if (error?.code === 'TEMPLATE_PRODUCT_ID_MISSING') {
      return res.status(400).json({ success:false,error:'TEMPLATE_PRODUCT_ID_MISSING',message:'ไม่พบ templateProductId' })
    }
    console.error('❌ getOperationalProductByTemplateId error:', error)
    return res.status(500).json({success:false,error:'RUNTIME_PRODUCT_LOOKUP_FAILED',message:'ตรวจสอบ Operational Product ไม่สำเร็จ'})
  }
}


const getProductsForOnline = async (req, res) => {
  try {
    const result = await findOperationalProductsForOnline({
      branchId: Number(req.user?.branchId) || toInt(req.query.branchId),
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      size: req.query.size,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })

    console.error('❌ getProductsForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getReadyToSell = async (req, res) => {
  try {
    const result = await getReadyToSellService({
      branchId: req.user?.branchId,
      q: req.query?.q,
      search: req.query?.search,
      searchText: req.query?.searchText,
      mode: req.query?.mode,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })

    console.error('❌ getReadyToSell error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}



const getReadyToSellStructuredDetails = async (req, res) => {
  try {
    const result = await getReadyToSellStructuredDetailsService({
      branchId: req.user?.branchId,
      productId: req.params.productId,
      q: req.query?.q || '',
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_PRODUCT_ID') return res.status(400).json({ error: 'invalid productId' })

    console.error('❌ getReadyToSellStructuredDetails error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}



const getProductPosById = async (req, res) => {
  try {
    const result = await findOperationalProductById({
      branchId: req.user?.branchId,
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductPosById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getProductOnlineById = async (req, res) => {
  try {
    const result = await findOperationalProductOnlineById({
      branchId: toInt(req.query.branchId) ?? Number(req.user?.branchId),
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductOnlineById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getProductDropdowns = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive ?? 'false').toLowerCase() === 'true'
    const branchId = Number(req.user?.branchId) || toInt(req.query?.branchId)

    if (!branchId) {
      return res.status(400).json({ error: 'BRANCH_REQUIRED', message: 'ไม่พบข้อมูลสาขา' })
    }

    const [types, unitsRaw, brandsRaw] = await Promise.all([
      prisma.productType.findMany({
        where: { branchId }, 
        orderBy: { name: 'asc' },
        include: { globalProductType: { select: { categoryId: true } } }
      }),
      prisma.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.brand.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, active: true },
      }),
    ])

    const scopedProductTypeIds = types.map((t) => Number(t.id)).filter(Boolean)
    const productTypeBrandsRaw = scopedProductTypeIds.length
      ? await prisma.productTypeBrand.findMany({
          where: { productTypeId: { in: scopedProductTypeIds } },
          orderBy: [{ productTypeId: 'asc' }, { brandId: 'asc' }],
          select: { productTypeId: true, brandId: true },
        })
      : []

    const productTypes = types.map((t) => ({
      id: Number(t.id),
      name: t.name,
      categoryId: t.globalProductType?.categoryId ? Number(t.globalProductType.categoryId) : null,
      globalProductTypeId: t.globalProductTypeId != null ? Number(t.globalProductTypeId) : null,
      branchId: Number(t.branchId),
    }))

    const brands = (brandsRaw || []).map((b) => ({ id: Number(b.id), name: b.name, active: !!b.active }))
    const units = (unitsRaw || []).map((u) => ({ id: Number(u.id), name: u.name }))
    
    const productTypeBrands = (productTypeBrandsRaw || []).map((x) => ({
      productTypeId: Number(x.productTypeId),
      brandId: Number(x.brandId),
    }))

    return res.json({
      // Backward-compatible placeholder only. FE product form no longer uses Category.
      categories: [],
      productTypes,
      productProfiles: [],
      productTemplates: [],
      brands,
      units,
      productTypeBrands,
      productModes: [
        { code: 'SIMPLE', name: 'Simple' },
        { code: 'STRUCTURED', name: 'Structure' },
      ],
    })
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  }
}

const createProduct = async (req, res) => {
  try {
    const data = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const name = normStr(data.name)
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' })

    const { mode, noSN, trackSerialNumber } = decideMode({
      explicitMode: (data.mode ?? data.stockMode ?? data.stockBehavior),
      noSN: data.noSN,
      trackSerialNumber: data.trackSerialNumber,
    })

    const bodyTypeId = toInt(data.productTypeId)
    const bodyCatId = toInt(data.categoryId)

    const typeCheck = await assertOperationalTypeAndCategory({ productTypeId: bodyTypeId, categoryId: bodyCatId, branchId })
    if (!typeCheck.ok) return res.status(400).json({ error: typeCheck.error })

    const newProduct = await prisma.product.create({
      data: {
        name,
        mode,
        trackSerialNumber,
        noSN,
        active: (typeof data.active === 'boolean' ? data.active : true),
        productTypeId: typeCheck.productTypeId,
        brandId: (data.brandId === null ? null : toInt(data.brandId)),
        unitId: (data.unitId === null ? null : toInt(data.unitId)),
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

    await autoLearnProductTypeBrand(prisma, typeCheck.productTypeId, data.brandId)
    const bp = pickBranchPricePayload(data)

    if (bp) {
      await prisma.branchPrice.create({
        data: {
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
    }

    return res.status(201).json({ id: newProduct.id })
  } catch (error) {
    console.error('❌ createProduct error:', error)
    return res.status(500).json({ error: 'Failed to create product' })
  }
}

const toIntOpt = (v) => {
  if (v === undefined || v === '' || v === null) return undefined
  return toInt(v)
}

const updateProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    const data = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })

    const shouldOverrideMode =
      data.mode !== undefined ||
      data.stockMode !== undefined ||
      data.stockBehavior !== undefined ||
      data.noSN !== undefined ||
      data.trackSerialNumber !== undefined

    const partialMode = shouldOverrideMode
      ? decideMode({
          explicitMode: (data.mode ?? data.stockMode ?? data.stockBehavior),
          noSN: data.noSN,
          trackSerialNumber: data.trackSerialNumber,
        })
      : null

    let learnLater = null

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({
        where: {
          id,
          productType: {
            branchId,
          },
        },
        select: { id: true, productTypeId: true },
      })
      if (!current) throw Object.assign(new Error('NOT_FOUND'), { status: 404, code: 'NOT_FOUND' })

      const incomingTypeId = toIntOpt(data.productTypeId)
      const incomingCatId = toIntOpt(data.categoryId)
      const effectiveTypeId = incomingTypeId ?? current.productTypeId

      const typeCheck = await assertOperationalTypeAndCategory({
        productTypeId: effectiveTypeId,
        categoryId: (incomingCatId ?? undefined),
        branchId,
      }, tx)
      if (!typeCheck.ok) throw Object.assign(new Error(typeCheck.error), { status: 400, code: typeCheck.error })

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
          productTypeId: (incomingTypeId !== undefined ? typeCheck.productTypeId : undefined),
          brandId: toIntOpt(data.brandId),
          unitId: toIntOpt(data.unitId),
        },
        select: { id: true },
      })

      if (data.brandId !== undefined && data.brandId !== null && data.brandId !== '') {
        learnLater = { productTypeId: typeCheck.productTypeId, brandId: toInt(data.brandId) }
      }

      const bp = pickBranchPricePayload(data)
      if (bp) {
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

    if (learnLater?.productTypeId && learnLater?.brandId) {
      try {
        await autoLearnProductTypeBrand(prisma, learnLater.productTypeId, learnLater.brandId)
      } catch (e) {}
    }

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

const disableProduct = async (_req, res) => {
  return res.status(403).json({ ok: false, error: 'FEATURE_DISABLED', message: 'Product เป็นข้อมูลกลาง ไม่อนุญาตให้ปิดใช้งาน' })
}

const enableProduct = async (_req, res) => {
  return res.status(403).json({ ok: false, error: 'FEATURE_DISABLED', message: 'Product เป็นข้อมูลกลาง ไม่อนุญาตให้เปิดใช้งาน' })
}

const getProductDeleteCheck = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

    const role = String(req.user?.role || '').toUpperCase()
    if (role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น' })
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    })
    if (!product) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const usage = await computeProductUsageCounts(prisma, id)
    if (!usage.ok) return res.status(400).json({ ok: false, error: usage.error || 'ERROR' })

    const reason = usage.canHardDelete ? 'NO_USAGE' : (usage.hasUnknown ? 'USAGE_UNKNOWN' : 'USED_IN_SYSTEM')

    return res.json({
      ok: true,
      product: {
        id: product.id,
        name: product.name,
        active: (typeof product.active === 'boolean' ? product.active : true),
      },
      canHardDelete: usage.canHardDelete,
      reason,
      counts: usage.counts,
    })
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
}

const archiveProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

    const role = String(req.user?.role || '').toUpperCase()
    if (role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น' })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { active: false },
      select: { id: true, name: true, active: true },
    })

    return res.json({ ok: true, success: true, product: updated })
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
}

const deleteProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

    const role = String(req.user?.role || '').toUpperCase()
    if (role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'อนุญาตเฉพาะ SUPERADMIN เท่านั้น' })
    }

    const usage = await computeProductUsageCounts(prisma, id)
    if (!usage.ok) return res.status(400).json({ ok: false, error: usage.error || 'ERROR' })

    if (!usage.canHardDelete) {
      return res.status(409).json({
        ok: false,
        error: 'PRODUCT_IN_USE',
        reason: usage.hasUnknown ? 'USAGE_UNKNOWN' : 'USED_IN_SYSTEM',
        message: 'ไม่สามารถลบสินค้าได้ เพราะมีประวัติการใช้งาน/อ้างอิงอยู่แล้ว',
        counts: usage.counts,
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.branchPrice.deleteMany({ where: { productId: id } })
      await tx.stockBalance.deleteMany({ where: { productId: id } })
      await tx.productImage.deleteMany({ where: { productId: id } })
      await tx.product.delete({ where: { id } })
    }, { timeout: 15000 })

    return res.json({ ok: true, success: true, id })
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
}

const deleteProductImage = async (req, res) => {
  try {
    const productId = toInt(req.params.id)
    const { public_id } = req.body
    const branchId = Number(req.user?.branchId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })
    if (!productId || !public_id) return res.status(400).json({ error: 'INVALID_PARAMS' })

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        productType: {
          branchId,
        },
      },
      select: { id: true },
    })

    if (!product) return res.status(404).json({ error: 'NOT_FOUND' })

    if (cloudinary?.uploader?.destroy) {
      try {
        await cloudinary.uploader.destroy(public_id)
      } catch (_e) {}
    }

    await prisma.productImage.updateMany({ where: { productId, public_id }, data: { active: false, isCover: false } })
    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

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
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductPosById,
  getReadyToSell,
  getReadyToSellStructuredDetails,
  disableProduct,
  enableProduct,
  getProductDeleteCheck,
  archiveProduct,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,
  getProductsForOnline,
  getProductOnlineById,
  getOperationalProductByTemplateId,
  getProductsForPos,
  migrateSnToSimple,
}