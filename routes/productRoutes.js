const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')
const verifyToken = require('../middlewares/verifyToken')

router.get('/online/dropdowns', productController.getProductDropdowns)
router.get('/online/search', productController.getProductsForOnline)
router.get('/online/detail/:id', productController.getProductOnlineById)

router.use(verifyToken)

router.get('/dropdowns', productController.getProductDropdowns)
router.get('/pos/search', productController.getProductsForPos)
router.get('/pos/runtime-by-template/:templateProductId', productController.getOperationalProductByTemplateId)
router.post('/pos/create-from-template', productController.createOperationalProductFromTemplate)
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
