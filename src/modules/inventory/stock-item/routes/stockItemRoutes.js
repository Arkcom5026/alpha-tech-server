'use strict'

const express = require('express')

const verifyToken = require('../../../../../middlewares/verifyToken')
const receiptSlices = require('../receipt/stockItemReceiptSlices')
const lifecycleSlices = require('../lifecycle/stockItemLifecycleSlices')
const receiveSlices = require('../receive/stockItemReceiveSlices')
const querySlices = require('../query/stockItemQuerySlices')
const {
  normalizeStockItemReceivePayload,
} = require('../receive/normalizeStockItemReceivePayload')

const router = express.Router()

router.use(verifyToken)

router.post('/', receiptSlices.addStockItemFromReceipt)
router.patch('/mark-sold', lifecycleSlices.markStockItemsAsSold)
router.get('/by-receipt/:receiptId', receiptSlices.getStockItemsByReceipt)
router.get('/search', querySlices.searchStockItem)
router.get('/available', querySlices.getAvailableStockItemsByProduct)
router.delete('/:id', lifecycleSlices.deleteStockItem)
router.patch('/:id/status', lifecycleSlices.updateStockItemStatus)
router.post('/by-receipt-ids', receiptSlices.getStockItemsByReceiptIds)
router.post('/receive-sn', normalizeStockItemReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive', normalizeStockItemReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive-all-no-sn', receiveSlices.receiveAllPendingNoSN)
router.patch('/update-sn/:barcode', querySlices.updateSerialNumber)

module.exports = router
