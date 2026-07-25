const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')
const productCatalogController = require('../src/modules/product/catalog/controllers/productCatalogController')
const productCreateLegacyCompatibilityController = require('../src/modules/product/create/controllers/productCreateLegacyCompatibilityController')
const productCreateDropdownCompatibilityController = require('../src/modules/product/create/controllers/productCreateDropdownCompatibilityController')
const operationalProductRuntimeController = require('../src/modules/product/runtime/controllers/operationalProductRuntimeController')
const productExistingModelPreviewRoutes = require('../src/modules/product/routes/productExistingModelPreviewRoutes')
const verifyToken = require('../middlewares/verifyToken')

router.get('/online/dropdowns', productCreateDropdownCompatibilityController.getProductDropdowns)
router.get('/online/search', operationalProductRuntimeController.getProductsForOnline)
router.get('/online/detail/:id', operationalProductRuntimeController.getProductOnlineById)

router.use(verifyToken)

router.get('/dropdowns', productCreateDropdownCompatibilityController.getProductDropdowns)
router.use('/duplicate-preview', productExistingModelPreviewRoutes)
router.get('/pos/search', operationalProductRuntimeController.getProductsForPos)
router.get('/pos/runtime-by-template/:templateProductId', operationalProductRuntimeController.getOperationalProductByTemplateId)
router.post('/pos/create-local', operationalProductRuntimeController.createLocalOperationalProduct)
router.post('/pos/create-from-template', operationalProductRuntimeController.createOperationalProductFromTemplate)
router.get('/pos/:id', operationalProductRuntimeController.getProductPosById)

router.get('/ready-to-sell', operationalProductRuntimeController.getReadyToSell)
router.get('/ready-to-sell/structured/:productId', operationalProductRuntimeController.getReadyToSellStructuredDetails)

router.get('/', productCatalogController.getAllProducts)
router.post('/', productCreateLegacyCompatibilityController.createProduct)
router.patch('/:id', productController.updateProduct)
router.post('/:id/disable', productController.disableProduct)
router.post('/:id/enable', productController.enableProduct)
router.get('/:id/delete-check', productController.getProductDeleteCheck)
router.patch('/:id/archive', productController.archiveProduct)
router.get('/:id', operationalProductRuntimeController.getProductPosById)
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
