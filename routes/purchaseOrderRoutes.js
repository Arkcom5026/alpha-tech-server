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

// Legacy handlers retained temporarily for capabilities not yet migrated.
const {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  createPurchaseOrderWithAdvance,
} = require('../controllers/purchaseOrderController');

// Receiving-owned projection remains outside Purchase Order migration scope.
const {
  getPurchaseOrderDetailById,
} = require('../controllers/purchaseOrderReceiptController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getPurchaseOrderList);
router.post('/', createPurchaseOrder);
router.get('/by-supplier/:supplierId', getPurchaseOrdersBySupplierHandler);
router.get('/by-supplier', getPurchaseOrdersBySupplierHandler);
router.post('/with-advance', createPurchaseOrderWithAdvance);

router.get('/eligible-for-receipt', getEligiblePurchaseOrdersForReceipt);
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatus);

module.exports = router;
