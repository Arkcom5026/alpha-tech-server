


// server/routes/barcodeRoutes.js
const express = require('express');
const router = express.Router();


const {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markReceiptAsCompleted,
  markBarcodesAsPrinted,
  auditReceiptBarcodes,
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
} = require('../controllers/barcodeController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดที่ขาด (ครั้งแรก)
router.post('/generate-missing/:receiptId', generateMissingBarcodes);

// ✅ ดึงบาร์โค้ดตามใบรับ
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);

// 🔎 ตรวจสุขภาพบาร์โค้ดของใบรับ (อ่านอย่างเดียว)
router.get('/receipt/:receiptId/audit', auditReceiptBarcodes);

// ✅ ดึงบาร์โค้ดสำหรับพิมพ์หลายใบแบบ batch (เร็ว/ลด N+1)
router.get('/print-batch', getBarcodesForPrintBatch);

// ✅ ดึงรายการใบรับที่มีบาร์โค้ด (ไว้ทำลิสต์)
router.get('/with-barcodes', getReceiptsWithBarcodes);
// alias เพื่อความเข้ากันได้กับ FE เดิม
router.get('/receipts-with-barcodes', getReceiptsWithBarcodes);

// ✅ ใบที่พร้อม "ยิง SN" (ยังมี SN ที่ stockItemId = null)
router.get('/ready-to-scan-sn', getReceiptsReadyToScanSN);
router.get('/receipts-ready-to-scan-sn', getReceiptsReadyToScanSN);

// ✅ ใบที่พร้อม "ยิง/เปิดล็อต" รวมทั้ง SN & LOT
router.get('/ready-to-scan', getReceiptsReadyToScan);
router.get('/receipts-ready-to-scan', getReceiptsReadyToScan);


router.get('/reprint-search', searchReprintReceipts);

// ✅ แก้ SN ของสินค้าที่รับเข้าแล้ว (เฉพาะ stock item ที่ยังไม่ SOLD)
router.patch('/update-serial-number', updateSerialNumber);

// ✅ ตีธง printed หลังพิมพ์ครั้งแรก
router.patch('/mark-printed', markBarcodesAsPrinted);

// ✅ พิมพ์ซ้ำ (ไม่สร้างใหม่/ไม่ mark เพิ่ม)
router.patch('/reprint/:receiptId', reprintBarcodes);

// ✅ ปิดงานใบรับ (complete) — แยก endpoint ชัดเจน
// canonical route
router.patch('/receipts/:receiptId/complete', markReceiptAsCompleted);
// backward‑compatible alias (FE เก่าอาจยังใช้ :id)
router.patch('/receipts/:id/complete', markReceiptAsCompleted);

module.exports = router;








