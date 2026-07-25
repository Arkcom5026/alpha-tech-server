// src/modules/product/query/routes/productQueryRoutes.js

const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const productListController = require('../list/controllers/productListController')
const productDropdownController = require('../dropdowns/controllers/productDropdownController')
const productPosSearchController = require('../posSearch/controllers/productPosSearchController')
const productPosDetailController = require('../posDetail/controllers/productPosDetailController')
const productRuntimeByTemplateController = require('../runtimeByTemplate/controllers/productRuntimeByTemplateController')
const productOnlineSearchController = require('../onlineSearch/controllers/productOnlineSearchController')
const productOnlineDetailController = require('../onlineDetail/controllers/productOnlineDetailController')
const productReadyToSellController = require('../readyToSell/controllers/productReadyToSellController')

const router = express.Router()

router.get('/online/dropdowns', productDropdownController.getDropdowns)
router.get('/online/search', productOnlineSearchController.searchProductsForOnline)
router.get('/online/detail/:id', productOnlineDetailController.getProductForOnline)

router.use(verifyToken)
router.get('/dropdowns', productDropdownController.getDropdowns)
router.get('/pos/search', productPosSearchController.searchProductsForPOS)
router.get('/pos/runtime-by-template/:templateProductId', productRuntimeByTemplateController.getRuntimeProductByTemplate)
router.get('/pos/:id', productPosDetailController.getProductForPOS)
router.get('/ready-to-sell', productReadyToSellController.listReadyToSell)
router.get('/ready-to-sell/structured/:productId', productReadyToSellController.getReadyToSellDetail)
router.get('/', productListController.listProducts)

module.exports = router
