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
const { verifyToken } = require('../middlewares/verifyToken');

router.use(verifyToken);

router.get('/', getAllPurchaseOrders);
router.post('/', createPurchaseOrder);
router.get('/by-supplier', getPurchaseOrdersBySupplier);
router.post('/with-advance', createPurchaseOrderWithAdvance);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatus);



            

module.exports = router;
