// src/modules/product/query/routes/productQueryRoutes.js

const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const productListController = require('../list/controllers/productListController')
const productDropdownController = require('../dropdowns/controllers/productDropdownController')

const router = express.Router()

router.get('/online/dropdowns', productDropdownController.getDropdowns)
router.use(verifyToken)
router.get('/dropdowns', productDropdownController.getDropdowns)
router.get('/', productListController.listProducts)

module.exports = router
