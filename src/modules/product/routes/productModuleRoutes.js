// src/modules/product/routes/productModuleRoutes.js

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')

const productQueryRoutes = require('../query/routes/productQueryRoutes')
const productExistingModelPreviewRoutes = require('./productExistingModelPreviewRoutes')
const productLegacyCreateController = require('../create/controllers/productLegacyCreateController')
const productUpdateController = require('../update/controllers/productUpdateController')
const productStatusController = require('../status/controllers/productStatusController')
const productDeleteController = require('../delete/controllers/productDeleteController')
const productImageDeleteController = require('../imageDelete/controllers/productImageDeleteController')
const productPricingController = require('../pricing/controllers/productPricingController')
const productMigrateToSimpleController = require('../migrateToSimple/controllers/productMigrateToSimpleController')
const {
  createLocalOperationalProduct: createLocalOperationalProductService,
  createOperationalProductFromTemplate: createOperationalProductFromTemplateService,
} = require('../services/operationalProductRuntimeService')

const router = express.Router()

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

router.use(productQueryRoutes)

router.use(verifyToken)
router.use('/duplicate-preview', productExistingModelPreviewRoutes)
router.post('/pos/create-local', createLocalOperationalProduct)
router.post('/pos/create-from-template', createOperationalProductFromTemplate)
router.post('/', productLegacyCreateController.createProduct)
router.patch('/:id', productUpdateController.updateProduct)
router.post('/:id/disable', productStatusController.disableProduct)
router.post('/:id/enable', productStatusController.enableProduct)
router.get('/:id/delete-check', productDeleteController.getDeleteCheck)
router.patch('/:id/archive', productStatusController.archiveProduct)
router.delete('/:id', productDeleteController.deleteProduct)
router.delete('/:id/images', productImageDeleteController.deleteProductImage)
router.post('/:id/migrate-to-simple', productMigrateToSimpleController.migrateToSimple)
router.get('/:productId/prices', productPricingController.getProductPrices)
router.put('/:productId/prices', productPricingController.updateProductPrices)
router.post('/:productId/prices', productPricingController.addProductPrice)
router.delete('/:productId/prices/:priceId', productPricingController.deleteProductPrice)

module.exports = router
