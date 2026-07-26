// purchaseOrderReceiptItemRoutes.js
const express = require('express');
const router = express.Router();
const {
  addReceiptItem,
  deleteReceiptItem,
  getPOItemsByPOId,
  updateReceiptItem,
} = require('../controllers/purchaseOrderReceiptItemController');
const listReceiptItemsController = require('../src/modules/procurement/receipt/query/items/listReceiptItemsController');
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addReceiptItem);
router.put('/update', updateReceiptItem);
router.patch('/update', updateReceiptItem);
router.get('/by-receipt/:receiptId', listReceiptItemsController.handle);

router.delete('/:id', deleteReceiptItem);
// ✅ Legacy route (kept for backward compatibility)
router.get('/:id/po-items', getPOItemsByPOId);
// ✅ Preferred explicit route
router.get('/po/:poId/items', getPOItemsByPOId);

module.exports = router;
