const express = require('express')
const router = express.Router()

const receiptSlices = require('../src/modules/inventory/stock-item/receipt/stockItemReceiptSlices')
const lifecycleSlices = require('../src/modules/inventory/stock-item/lifecycle/stockItemLifecycleSlices')
const receiveSlices = require('../src/modules/inventory/stock-item/receive/stockItemReceiveSlices')
const querySlices = require('../src/modules/inventory/stock-item/query/stockItemQuerySlices')
const verifyToken = require('../middlewares/verifyToken')

function normalizeReceivePayload(req, _res, next) {
  try {
    const body = req.body || {}
    if (body && typeof body === 'object') {
      if (typeof body.barcode === 'string') {
        req.body = { barcode: { barcode: body.barcode, serialNumber: body.serialNumber } }
      } else if (body.barcode && typeof body.barcode === 'object' && typeof body.barcode.barcode === 'string') {
        // already normalized
      } else if (typeof body.code === 'string') {
        req.body = { barcode: { barcode: body.code, serialNumber: body.serialNumber } }
      }
    }
  } catch (_) {}
  next()
}

router.use(verifyToken)

router.post('/', receiptSlices.addStockItemFromReceipt)
router.patch('/mark-sold', lifecycleSlices.markStockItemsAsSold)
router.get('/by-receipt/:receiptId', receiptSlices.getStockItemsByReceipt)
router.get('/search', querySlices.searchStockItem)
router.get('/available', querySlices.getAvailableStockItemsByProduct)
router.delete('/:id', lifecycleSlices.deleteStockItem)
router.patch('/:id/status', lifecycleSlices.updateStockItemStatus)
router.post('/by-receipt-ids', receiptSlices.getStockItemsByReceiptIds)
router.post('/receive-sn', normalizeReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive', normalizeReceivePayload, receiveSlices.receiveStockItem)
router.post('/receive-all-no-sn', receiveSlices.receiveAllPendingNoSN)
router.patch('/update-sn/:barcode', querySlices.updateSerialNumber)

module.exports = router
