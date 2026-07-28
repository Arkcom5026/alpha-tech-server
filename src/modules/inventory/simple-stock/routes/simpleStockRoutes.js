'use strict'

const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const { pingSimpleStock } = require('../health/simpleStockHealthController')
const { createSimpleReceipt } = require('../receipt/simpleStockReceiptController')
const { createSimpleSale } = require('../sale/simpleStockSaleController')
const {
  createSimpleAdjustment,
} = require('../adjust/simpleStockAdjustmentController')
const { createSimpleTransfer } = require('../transfer/simpleStockTransferController')

const router = express.Router()

router.use(verifyToken)
router.get('/ping', pingSimpleStock)
router.post('/receipts', createSimpleReceipt)
router.post('/sales', createSimpleSale)
router.post('/adjustments', createSimpleAdjustment)
router.post('/transfers', createSimpleTransfer)

module.exports = router
