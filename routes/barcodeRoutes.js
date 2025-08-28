// server/routes/barcodeRoutes.js
const express = require('express');
const router = express.Router();


const {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,  
  searchReprintReceipts,
  reprintBarcodes, // ✅ ต้องอยู่ใน require ด้วย
} = require('../controllers/barcodeController'); // <- พาธจาก routes → controllers

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดที่ขาด (ครั้งแรก)
router.post('/generate-missing/:receiptId',  generateMissingBarcodes);

// ✅ ดึงบาร์โค้ดตามใบรับ
router.get('/by-receipt/:receiptId',  getBarcodesByReceiptId);

// ✅ ดึงรายการใบรับที่มีบาร์โค้ด (ไว้ทำลิสต์)
router.get('/with-barcodes', getReceiptsWithBarcodes);

// ✅ ค้นหาใบรับสำหรับพิมพ์ซ้ำ (เรียก BE ทุกครั้ง)
// หมายเหตุ: ตอนนี้ชี้ไปที่ getReceiptsWithBarcodes ชั่วคราว
// หากมี controller `searchReprintReceipts` แล้ว ให้เปลี่ยนเป็นฟังก์ชันนั้นแทน
router.get('/reprint-search', searchReprintReceipts);


// ✅ พิมพ์ซ้ำ (ไม่สร้างใหม่/ไม่ mark เพิ่ม)
router.patch('/reprint/:receiptId',  reprintBarcodes);

module.exports = router;
