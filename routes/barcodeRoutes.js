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
  auditReceiptBarcodes,
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
} = require('../controllers/barcodeController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างบาร์โค้ดที่ขาด (ครั้งแรก)
router.post('/generate-missing/:receiptId', generateMissingBarcodes);

// ✅ ดึงบาร์โค้ดตามใบรับ
router.get('/by-receipt/:receiptId', getBarcodesByReceiptId);

// 🔎 ตรวจสุขภาพบาร์โค้ดของใบรับ (อ่านอย่างเดียว)
router.get('/receipt/:receiptId/audit', auditReceiptBarcodes);

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

// ✅ ตีธง printed หลังพิมพ์ครั้งแรก
router.patch('/mark-printed', markBarcodesAsPrinted);

// ✅ พิมพ์ซ้ำ (ไม่สร้างใหม่/ไม่ mark เพิ่ม)
router.patch('/reprint/:receiptId', reprintBarcodes);

// ✅ ปิดงานใบรับ (complete) — แยก endpoint ชัดเจน
router.patch('/receipts/:id/complete', markReceiptAsCompleted);

module.exports = router;







