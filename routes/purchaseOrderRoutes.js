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

// Legacy handlers retained temporarily for capabilities not yet migrated.
const {
  deletePurchaseOrder,
  createPurchaseOrderWithAdvance,
} = require('../controllers/purchaseOrderController');

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
router.post('/with-advance', createPurchaseOrderWithAdvance);

router.get('/eligible-for-receipt', getEligiblePurchaseOrdersForReceipt);
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById);
router.put('/:id', updatePurchaseOrderHandler);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatusHandler);

module.exports = router;
