// server/routes/barcodeRoutes.js
const express = require('express');
const router = express.Router();


const {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markReceiptAsCompleted,
  markBarcodesAsPrinted,
} = require('../controllers/barcodeController'); // <- พาธจาก routes → controllers

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดที่ขาด (ครั้งแรก)
router.post('/generate-missing/:receiptId', generateMissingBarcodes);

// ✅ ดึงบาร์โค้ดตามใบรับ
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);

// ✅ ดึงรายการใบรับที่มีบาร์โค้ด (ไว้ทำลิสต์)
router.get('/with-barcodes', getReceiptsWithBarcodes);


router.get('/reprint-search', searchReprintReceipts);

// ✅ ตีธง printed หลังพิมพ์ครั้งแรก
router.patch('/mark-printed', markBarcodesAsPrinted);

// ✅ พิมพ์ซ้ำ (ไม่สร้างใหม่/ไม่ mark เพิ่ม)
// ✅ พิมพ์ซ้ำ (ไม่สร้างใหม่/ไม่ mark เพิ่ม)
router.patch('/reprint/:receiptId', reprintBarcodes);

// ✅ ปิดงานใบรับ (complete) — แยก endpoint ชัดเจน
router.patch('/receipts/:id/complete', markReceiptAsCompleted);

module.exports = router;

