



// ✅ purchaseOrderRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrdersBySupplier,
  createPurchaseOrderWithAdvance,
} = require('../controllers/purchaseOrderController');

// ✅ Receipt helpers (used by CreatePurchaseOrderReceiptPage)
const {
  getEligiblePurchaseOrders,
  getPurchaseOrderDetailById,
} = require('../controllers/purchaseOrderReceiptController');
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getAllPurchaseOrders);
router.post('/', createPurchaseOrder);
router.get('/by-supplier', getPurchaseOrdersBySupplier);
router.post('/with-advance', createPurchaseOrderWithAdvance);

// ✅ Purchase Orders eligible for creating a receipt
router.get('/eligible-for-receipt', getEligiblePurchaseOrders);
// ✅ Purchase Order detail payload tailored for receipt creation
router.get('/:id/detail-for-receipt', getPurchaseOrderDetailById);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatus);



            

module.exports = router;







