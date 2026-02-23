
// purchaseOrderReceiptItemRoutes.js
const express = require('express');
const router = express.Router();
const {
  addReceiptItem,
  getReceiptItemsByReceiptId,
  deleteReceiptItem,
  getPOItemsByPOId,
  updateReceiptItem,
} = require('../controllers/purchaseOrderReceiptItemController');
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);


router.post('/', addReceiptItem);
router.put('/update', updateReceiptItem);
router.patch('/update', updateReceiptItem);
router.get('/by-receipt/:receiptId', getReceiptItemsByReceiptId);

router.delete('/:id', deleteReceiptItem);
// ✅ Legacy route (kept for backward compatibility)
router.get('/:id/po-items', getPOItemsByPOId);
// ✅ Preferred explicit route
router.get('/po/:poId/items', getPOItemsByPOId);




module.exports = router;
  


