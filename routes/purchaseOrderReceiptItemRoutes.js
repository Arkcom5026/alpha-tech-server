const express = require('express');
const router = express.Router();
const {
  addReceiptItem,
  getReceiptItemsByReceiptId,
  deleteReceiptItem,
  getPOItemsByPOId,
  updateReceiptItem,
} = require('../controllers/purchaseOrderReceiptItemController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);


router.post('/', addReceiptItem);
router.get('/by-receipt/:receiptId', getReceiptItemsByReceiptId);
                                     
            
router.delete('/:id', deleteReceiptItem);
router.get('/:id/po-items', getPOItemsByPOId);
router.put('/update', updateReceiptItem); 



module.exports = router;
  
