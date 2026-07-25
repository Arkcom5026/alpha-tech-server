// ✅ purchaseOrderRoutes.js — incremental Purchase Order migration
const express = require('express');
const router = express.Router();

const {
  getPurchaseOrderList,
} = require('../src/modules/procurement/purchaseOrder/query/list/purchaseOrderListController');
const {
  getPurchaseOrderById,
} = require('../src/modules/procurement/purchaseOrder/query/detail/purchaseOrderDetailController');
const {
  getPurchaseOrdersBySupplierHandler,
} = require('../src/modules/procurement/purchaseOrder/query/bySupplier/purchaseOrderBySupplierController');
const {
  getEligiblePurchaseOrdersForReceipt,
} = require('../src/modules/procurement/purchaseOrder/query/eligibleForReceipt/purchaseOrderEligibleForReceiptController');
const {
  createPurchaseOrderHandler,
} = require('../src/modules/procurement/purchaseOrder/create/purchaseOrderCreateController');
const {
  updatePurchaseOrderHandler,
} = require('../src/modules/procurement/purchaseOrder/update/purchaseOrderUpdateController');
const {
  updatePurchaseOrderStatusHandler,
} = require('../src/modules/procurement/purchaseOrder/status/purchaseOrderStatusController');
const {
  deletePurchaseOrderHandler,
} = require('../src/modules/procurement/purchaseOrder/delete/purchaseOrderDeleteController');

// Receiving-owned projection remains outside Purchase Order migration scope.
const {
  getPurchaseOrderDetailById,
} = require('../controllers/purchaseOrderReceiptController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getPurchaseOrderList);
router.post('/', createPurchaseOrderHandler);
router.get('/by-supplier/:supplierId', getPurchaseOrdersBySupplierHandler);
router.get('/by-supplier', getPurchaseOrdersBySupplierHandler);

// Compatibility alias: the historical endpoint never supported applying advance payments.
// Keep the URL stable while routing creation through the canonical Purchase Order capability.
router.post('/with-advance', createPurchaseOrderHandler);

router.get('/eligible-for-receipt', getEligiblePurchaseOrdersForReceipt);
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById);
router.put('/:id', updatePurchaseOrderHandler);
router.delete('/:id', deletePurchaseOrderHandler);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatusHandler);

module.exports = router;
