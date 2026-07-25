// ✅ purchaseOrderRoutes.js — incremental Purchase Order migration
const express = require('express');
const router = express.Router();

const {
  getPurchaseOrderList,
} = require('../src/modules/procurement/purchaseOrder/query/list/purchaseOrderListController');

// Legacy handlers retained temporarily for capabilities not yet migrated.
const {
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrdersBySupplier,
  createPurchaseOrderWithAdvance,
} = require('../controllers/purchaseOrderController');

// Receipt-owned helper endpoints remain outside Purchase Order migration scope.
const {
  getEligiblePurchaseOrders,
  getPurchaseOrderDetailById,
} = require('../controllers/purchaseOrderReceiptController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getPurchaseOrderList);
router.post('/', createPurchaseOrder);
router.get('/by-supplier', getPurchaseOrdersBySupplier);
router.post('/with-advance', createPurchaseOrderWithAdvance);

router.get('/eligible-for-receipt', getEligiblePurchaseOrders);
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatus);

module.exports = router;
