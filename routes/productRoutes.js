const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')
const productDuplicatePreviewController = require('../controllers/productDuplicatePreviewController')
const verifyToken = require('../middlewares/verifyToken')
const {
  createLocalOperationalProduct: createLocalOperationalProductService,
  createOperationalProductFromTemplate: createOperationalProductFromTemplateService,
} = require('../src/modules/product/services/operationalProductRuntimeService')

const createLocalOperationalProduct = async (req, res) => {
  try {
    const result = await createLocalOperationalProductService({
      branchId: req.user?.branchId,
      data: req.body || {},
    })

    return res.status(201).json(result)
  } catch (error) {
    console.error('createLocalOperationalProduct error:', error)
    const status = error?.status || error?.statusCode || 500
    return res.status(status).json({
      success: false,
      error: error?.code || error?.message || 'CREATE_LOCAL_OPERATIONAL_PRODUCT_FAILED',
    })
  }
}

const createOperationalProductFromTemplate = async (req, res) => {
  try {
    const result = await createOperationalProductFromTemplateService({
      branchId: req.user?.branchId,
      templateProductId: req.body?.templateProductId,
    })

    const status = result.statusCode || (result.created ? 201 : 200)
    const { statusCode, ...payload } = result

    return res.status(status).json(payload)
  } catch (error) {
    console.error('createOperationalProductFromTemplate error:', error)

    const code = error?.code || error?.message
    if (
      code === 'BRANCH_ID_MISSING' ||
      code === 'TEMPLATE_PRODUCT_ID_MISSING' ||
      code === 'TEMPLATE_BRANCH_NOT_FOUND' ||
      code === 'TEMPLATE_PRODUCT_NOT_FOUND' ||
      code === 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
    ) {
      return res.status(error?.status || error?.statusCode || 400).json({
        success: false,
        error: code,
      })
    }

    return res.status(500).json({
      success: false,
      error: 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_FAILED',
    })
  }
}

router.get('/online/dropdowns', productController.getProductDropdowns)
router.get('/online/search', productController.getProductsForOnline)
router.get('/online/detail/:id', productController.getProductOnlineById)

router.use(verifyToken)

router.get('/dropdowns', productController.getProductDropdowns)
router.get('/duplicate-preview', productDuplicatePreviewController.getProductDuplicatePreview)
router.get('/pos/search', productController.getProductsForPos)
router.get('/pos/runtime-by-template/:templateProductId', productController.getOperationalProductByTemplateId)
router.post('/pos/create-local', createLocalOperationalProduct)
router.post('/pos/create-from-template', createOperationalProductFromTemplate)
router.get('/pos/:id', productController.getProductPosById)

if (typeof productController.getReadyToSell === 'function') {
  router.get('/ready-to-sell', productController.getReadyToSell)
} else {
  router.get('/ready-to-sell', (_req, res) =>
    res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL' })
  )
}

if (typeof productController.getReadyToSellStructuredDetails === 'function') {
  router.get('/ready-to-sell/structured/:productId', productController.getReadyToSellStructuredDetails)
} else {
  router.get('/ready-to-sell/structured/:productId', (_req, res) =>
    res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL_DETAILS' })
  )
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
try {
  productPriceController = require('../controllers/productPriceController')
} catch (_e) {
  productPriceController = null
}

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
