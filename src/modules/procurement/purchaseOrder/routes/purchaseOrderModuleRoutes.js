const express = require('express')

const {
  getPurchaseOrderList,
} = require('../query/list/purchaseOrderListController')
const {
  getPurchaseOrderById,
} = require('../query/detail/purchaseOrderDetailController')
const {
  getPurchaseOrdersBySupplierHandler,
} = require('../query/bySupplier/purchaseOrderBySupplierController')
const {
  getEligiblePurchaseOrdersForReceipt,
} = require('../query/eligibleForReceipt/purchaseOrderEligibleForReceiptController')
const {
  createPurchaseOrderHandler,
} = require('../create/purchaseOrderCreateController')
const {
  updatePurchaseOrderHandler,
} = require('../update/purchaseOrderUpdateController')
const {
  updatePurchaseOrderStatusHandler,
} = require('../status/purchaseOrderStatusController')
const {
  deletePurchaseOrderHandler,
} = require('../delete/purchaseOrderDeleteController')
const {
  getPurchaseOrderDetailById,
} = require('../../../../../controllers/purchaseOrderReceiptController')
const verifyToken = require('../../../../../middlewares/verifyToken')

const router = express.Router()

router.use(verifyToken)

router.get('/', getPurchaseOrderList)
router.post('/', createPurchaseOrderHandler)
router.get('/by-supplier/:supplierId', getPurchaseOrdersBySupplierHandler)
router.get('/by-supplier', getPurchaseOrdersBySupplierHandler)

// Compatibility alias: advance payments were never applied during PO creation.
router.post('/with-advance', createPurchaseOrderHandler)

router.get('/eligible-for-receipt', getEligiblePurchaseOrdersForReceipt)

// Receiving-owned projection remains temporarily mounted here to preserve the public URL.
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById)

router.put('/:id', updatePurchaseOrderHandler)
router.delete('/:id', deletePurchaseOrderHandler)
router.get('/:id', getPurchaseOrderById)
router.patch('/:id/status', updatePurchaseOrderStatusHandler)

module.exports = router
