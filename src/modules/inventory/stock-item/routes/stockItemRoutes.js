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
const {
  STOCK_ITEM_CAPABILITY,
  allowStockItemCapabilities,
} = require('../shared/stockItemAuthorization')

const router = express.Router()

router.use(verifyToken)

const allowInventoryReceive = allowStockItemCapabilities(STOCK_ITEM_CAPABILITY.RECEIVE)
const allowInventoryLifecycle = allowStockItemCapabilities(STOCK_ITEM_CAPABILITY.LIFECYCLE)

router.post('/', allowInventoryReceive, receiptSlices.addStockItemFromReceipt)
router.patch('/mark-sold', lifecycleSlices.markStockItemsAsSold)
router.get('/by-receipt/:receiptId', receiptSlices.getStockItemsByReceipt)
router.get('/search', querySlices.searchStockItem)
router.get('/available', querySlices.getAvailableStockItemsByProduct)
router.delete('/:id', allowInventoryLifecycle, lifecycleSlices.deleteStockItem)
router.patch('/:id/status', allowInventoryLifecycle, lifecycleSlices.updateStockItemStatus)
router.post('/by-receipt-ids', receiptSlices.getStockItemsByReceiptIds)
router.post('/receive-sn', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive-all-no-sn', allowInventoryReceive, receiveSlices.receiveAllPendingNoSN)
router.patch('/update-sn/:barcode', allowInventoryReceive, querySlices.updateSerialNumber)

module.exports = router
