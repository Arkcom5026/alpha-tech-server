// src/routes/barcodeRoutes.js

const express = require('express');
const router = express.Router();

const {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  
} = require('../controllers/barcodeController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดสำหรับ receipt ที่ยังไม่ถูก gen
router.post('/generate-missing/:receiptId', generateMissingBarcodes);

// ✅ ดึงบาร์โค้ดทั้งหมดของ receipt หนึ่งใบ
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);

router.get('/with-barcodes', getReceiptsWithBarcodes);



module.exports = router;

   


