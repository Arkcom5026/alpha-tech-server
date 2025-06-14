// src/routes/barcodeRoutes.js

const express = require('express');
const router = express.Router();

const {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  markBarcodesAsPrinted,
} = require('../controllers/barcodeController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดสำหรับ receipt ที่ยังไม่ถูก gen
router.post('/generate-missing/:receiptId', generateMissingBarcodes);

// ✅ อัปเดตสถานะ printed ของบาร์โค้ด
router.patch('/mark-printed', markBarcodesAsPrinted);

// ✅ ดึงบาร์โค้ดทั้งหมดของ receipt หนึ่งใบ
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);

// ✅ ดึงรายการใบรับสินค้าที่มีบาร์โค้ด
router.get('/with-barcodes', getReceiptsWithBarcodes);



module.exports = router;
