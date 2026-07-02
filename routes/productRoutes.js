const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')
const verifyToken = require('../middlewares/verifyToken')
const { prisma } = require('../lib/prisma')

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number.parseInt(v, 10))

const toRuntimeProduct = (product, branchId) => ({
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
  costPrice: 0,
  priceRetail: 0,
  priceWholesale: 0,
  priceTechnician: 0,
  priceOnline: 0,
  branchPriceActive: false,
  hasPrice: false,
  available: 0,
  stockBalance: null,
  branchPrice: [],
  branchId,
})

const runtimeSelect = {
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
      select: runtimeSelect,
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

    const runtime = await prisma.product.findFirst({ where: { id: created.id, productType: { branchId } }, select: runtimeSelect })
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
