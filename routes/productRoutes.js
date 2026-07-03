const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')
const verifyToken = require('../middlewares/verifyToken')
const { prisma } = require('../lib/prisma')

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number.parseInt(v, 10))
const toNum = (v) => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(typeof v === 'string' ? v.trim().replace(/,/g, '') : v)
  return Number.isFinite(n) ? n : undefined
}

const pickBranchPricePayload = (data = {}) => {
  const d = data && typeof data === 'object' ? data : {}
  const bp = d.branchPrice && typeof d.branchPrice === 'object' ? d.branchPrice : {}
  const hasNested = ['costPrice', 'priceRetail', 'priceWholesale', 'priceTechnician', 'priceOnline', 'isActive'].some((k) => bp[k] !== undefined)
  if (hasNested) return bp

  const flat = {
    costPrice: d.costPrice,
    priceRetail: d.priceRetail,
    priceWholesale: d.priceWholesale,
    priceTechnician: d.priceTechnician,
    priceOnline: d.priceOnline,
    isActive: d.branchPriceActive ?? d.isActive,
  }
  const hasFlat = ['costPrice', 'priceRetail', 'priceWholesale', 'priceTechnician', 'priceOnline', 'isActive'].some((k) => flat[k] !== undefined)
  return hasFlat ? flat : null
}

const decideLocalMode = ({ explicitMode, noSN, trackSerialNumber }) => {
  const rawMode = explicitMode === undefined || explicitMode === null ? '' : String(explicitMode).trim()
  const exp = rawMode ? rawMode.toUpperCase() : undefined
  const hasNoSN = noSN !== undefined
  const hasTrack = trackSerialNumber !== undefined
  const n = noSN === true || noSN === 'true' || noSN === 1 || noSN === '1'
  const t = trackSerialNumber === true || trackSerialNumber === 'true' || trackSerialNumber === 1 || trackSerialNumber === '1'

  if (exp === 'SIMPLE' || exp === 'NOSN' || exp === 'NO_SN' || exp === 'NO-SN') return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  if (exp === 'STRUCTURED' || exp === 'SN') return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  if (hasNoSN || hasTrack) {
    if (t) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
    if (hasNoSN && n === false) return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
    if (hasNoSN && n === true) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
    if (hasTrack && t === false) return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }
  return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
}

const toRuntimeProduct = (product, branchId) => {
  const bp = product.branchPrice?.[0] || null
  const sb = product.stockBalances?.[0] || null
  const quantity = Number(sb?.quantity ?? 0)
  const reserved = Number(sb?.reserved ?? 0)
  const available = Math.max(0, quantity - reserved)

  return {
    id: product.id,
    active: product.active !== false,
    name: product.name,
    mode: product.mode,
    noSN: product.noSN,
    trackSerialNumber: product.trackSerialNumber,
    templateProductId: product.templateProductId,
    isTemplateProduct: false,
    isOperationalProduct: true,
    categoryId: product.productType?.globalProductType?.category?.id ?? null,
    categoryName: product.productType?.globalProductType?.category?.name ?? null,
    category: product.productType?.globalProductType?.category?.name ?? '-',
    productTypeId: product.productTypeId ?? null,
    productTypeName: product.productType?.name ?? '-',
    productType: product.productType?.name ?? '-',
    brandId: product.brandId ?? product.brand?.id ?? null,
    brandName: product.brand?.name ?? null,
    unitId: product.unitId ?? product.unit?.id ?? null,
    unitName: product.unit?.name ?? null,
    unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
    costPrice: Number(bp?.costPrice ?? sb?.lastReceivedCost ?? 0),
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
    branchPriceActive: bp?.isActive ?? false,
    hasPrice: !!bp,
    available,
    stockBalance: sb
      ? {
          quantity,
          reserved,
          available,
          lastReceivedCost: sb.lastReceivedCost,
        }
      : null,
    branchPrice: bp ? [bp] : [],
    branchId,
  }
}

const runtimeSelect = (branchId) => ({
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
      globalProductType: { select: { category: { select: { id: true, name: true } } } },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true } },
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
      priceWholesale: true,
      priceTechnician: true,
      priceOnline: true,
      isActive: true,
    },
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

const fetchRuntimeProduct = (productId, branchId, db = prisma) => db.product.findFirst({
  where: { id: productId, active: true, productType: { branchId } },
  select: runtimeSelect(branchId),
})

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

const createLocalOperationalProduct = async (req, res) => {
  const branchId = Number(req.user?.branchId)
  if (!branchId) return res.status(401).json({ success: false, error: 'BRANCH_ID_MISSING' })

  const data = req.body || {}

  if (data.branchId !== undefined) return res.status(400).json({ success: false, error: 'BODY_BRANCH_ID_NOT_ALLOWED' })
  if (data.templateProductId !== undefined) return res.status(400).json({ success: false, error: 'TEMPLATE_PRODUCT_ID_NOT_ALLOWED' })
  if (Array.isArray(data.barcodes) || Array.isArray(data.items)) return res.status(400).json({ success: false, error: 'STOCK_QUEUE_NOT_ALLOWED' })

  const name = String(data.name || '').trim()
  if (!name) return res.status(400).json({ success: false, error: 'NAME_REQUIRED' })

  const productTypeId = toInt(data.productTypeId)
  if (!productTypeId) return res.status(400).json({ success: false, error: 'PRODUCT_TYPE_REQUIRED' })

  const pricePayload = pickBranchPricePayload(data)
  if (!pricePayload) return res.status(400).json({ success: false, error: 'BRANCH_PRICE_REQUIRED' })

  const costPrice = toNum(pricePayload.costPrice)
  const priceRetail = toNum(pricePayload.priceRetail)
  if (!costPrice || costPrice <= 0) return res.status(400).json({ success: false, error: 'COST_PRICE_REQUIRED' })
  if (!priceRetail || priceRetail <= 0) return res.status(400).json({ success: false, error: 'PRICE_RETAIL_REQUIRED' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const productType = await tx.productType.findFirst({
        where: { id: productTypeId, branchId },
        select: { id: true, globalProductType: { select: { categoryId: true } } },
      })
      if (!productType) throw Object.assign(new Error('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'), { status: 400, code: 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH' })

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
        where: { productId_branchId: { productId: product.id, branchId } },
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
          branchId,
          costPrice,
          priceRetail,
          priceWholesale: toNum(pricePayload.priceWholesale),
          priceTechnician: toNum(pricePayload.priceTechnician),
          priceOnline: toNum(pricePayload.priceOnline),
          isActive: typeof pricePayload.isActive === 'boolean' ? pricePayload.isActive : true,
        },
      })

      await autoLearnProductTypeBrand(tx, productType.id, data.brandId)

      const runtime = await fetchRuntimeProduct(product.id, branchId, tx)
      return runtime
    }, { timeout: 15000 })

    const mapped = toRuntimeProduct(result, branchId)
    return res.status(201).json({ success: true, created: true, data: mapped, product: mapped, branchId })
  } catch (error) {
    console.error('createLocalOperationalProduct error:', error)
    const status = error?.status || error?.statusCode || 500
    return res.status(status).json({ success: false, error: error?.code || error?.message || 'CREATE_LOCAL_OPERATIONAL_PRODUCT_FAILED' })
  }
}

const createOperationalProductFromTemplate = async (req, res) => {
  const branchId = Number(req.user?.branchId)
  if (!branchId) return res.status(401).json({ success: false, error: 'BRANCH_ID_MISSING' })

  const templateProductId = toInt(req.body?.templateProductId)
  if (!templateProductId) return res.status(400).json({ success: false, error: 'TEMPLATE_PRODUCT_ID_MISSING' })

  try {
    const templateBranch = await prisma.branch.findFirst({ where: { branchCode: 'T01' }, select: { id: true } })
    if (!templateBranch) return res.status(404).json({ success: false, error: 'TEMPLATE_BRANCH_NOT_FOUND' })

    const template = await prisma.product.findFirst({
      where: { id: templateProductId, active: true, productType: { branchId: templateBranch.id } },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        brandId: true,
        unitId: true,
        productType: { select: { globalProductTypeId: true } },
      },
    })
    if (!template) return res.status(404).json({ success: false, error: 'TEMPLATE_PRODUCT_NOT_FOUND' })

    const existing = await prisma.product.findFirst({
      where: { active: true, templateProductId, productType: { branchId } },
      select: runtimeSelect(branchId),
      orderBy: { id: 'desc' },
    })
    if (existing) {
      const mapped = toRuntimeProduct(existing, branchId)
      return res.status(200).json({ success: true, created: false, exists: true, data: mapped, product: mapped, templateProductId, branchId })
    }

    const branchType = await prisma.productType.findFirst({
      where: { branchId, globalProductTypeId: template.productType?.globalProductTypeId },
      select: { id: true, globalProductType: { select: { categoryId: true } } },
    })
    if (!branchType) return res.status(400).json({ success: false, error: 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH' })

    const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true
    const created = await prisma.product.create({
      data: {
        name: template.name,
        mode: structured ? 'STRUCTURED' : 'SIMPLE',
        noSN: !structured,
        trackSerialNumber: structured,
        active: true,
        templateProductId,
        productTypeId: branchType.id,
        categoryId: branchType.globalProductType?.categoryId ?? null,
        brandId: template.brandId ?? null,
        unitId: template.unitId ?? null,
      },
      select: { id: true },
    })

    const runtime = await fetchRuntimeProduct(created.id, branchId)
    const mapped = toRuntimeProduct(runtime, branchId)

    return res.status(201).json({ success: true, created: true, exists: false, data: mapped, product: mapped, templateProductId, branchId })
  } catch (error) {
    console.error('createOperationalProductFromTemplate error:', error)
    return res.status(500).json({ success: false, error: 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_FAILED' })
  }
}

router.get('/online/dropdowns', productController.getProductDropdowns)
router.get('/online/search', productController.getProductsForOnline)
router.get('/online/detail/:id', productController.getProductOnlineById)

router.use(verifyToken)

router.get('/dropdowns', productController.getProductDropdowns)
router.get('/pos/search', productController.getProductsForPos)
router.get('/pos/runtime-by-template/:templateProductId', productController.getOperationalProductByTemplateId)
router.post('/pos/create-local', createLocalOperationalProduct)
router.post('/pos/create-from-template', createOperationalProductFromTemplate)
router.get('/pos/:id', productController.getProductPosById)

if (typeof productController.getReadyToSell === 'function') {
  router.get('/ready-to-sell', productController.getReadyToSell)
} else {
  router.get('/ready-to-sell', (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL' }))
}

if (typeof productController.getReadyToSellStructuredDetails === 'function') {
  router.get('/ready-to-sell/structured/:productId', productController.getReadyToSellStructuredDetails)
} else {
  router.get('/ready-to-sell/structured/:productId', (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL_DETAILS' }))
}

router.get('/', productController.getAllProducts)
router.post('/', productController.createProduct)
router.patch('/:id', productController.updateProduct)
router.post('/:id/disable', productController.disableProduct)
router.post('/:id/enable', productController.enableProduct)
router.get('/:id/delete-check', productController.getProductDeleteCheck)
router.patch('/:id/archive', productController.archiveProduct)
router.get('/:id', productController.getProductPosById)
router['delete']('/:id', productController.deleteProduct)
router['delete']('/:id/images', productController.deleteProductImage)
router.post('/:id/migrate-to-simple', productController.migrateSnToSimple)

let productPriceController = null
try { productPriceController = require('../controllers/productPriceController') } catch (_e) { productPriceController = null }

if (productPriceController) {
  router.get('/:productId/prices', productPriceController.getProductPrices)
  router.put('/:productId/prices', productPriceController.updateProductPrices)
  router.post('/:productId/prices', productPriceController.addProductPrice)
  router['delete']('/:productId/prices/:priceId', productPriceController.deleteProductPrice)
} else {
  const notImplemented = (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED' })
  router.get('/:productId/prices', notImplemented)
  router.put('/:productId/prices', notImplemented)
  router.post('/:productId/prices', notImplemented)
  router['delete']('/:productId/prices/:priceId', notImplemented)
}

module.exports = router
