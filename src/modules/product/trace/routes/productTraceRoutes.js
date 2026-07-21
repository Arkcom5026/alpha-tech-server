const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const { getProductTraceByBarcode } = require('../controllers/productTraceController')

const router = express.Router()

router.use(verifyToken)
router.get('/by-barcode/:barcode', getProductTraceByBarcode)

module.exports = router
