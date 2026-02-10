// purchaseOrderReceiptRoutes.js

const express = require('express');
const router = express.Router();

const {
  createPurchaseOrderReceipt,
  getAllPurchaseOrderReceipts,
  getPurchaseOrderReceiptById,
  updatePurchaseOrderReceipt,
  deletePurchaseOrderReceipt,
  getReceiptBarcodeSummaries,
  finalizeReceiptController,
  markPurchaseOrderReceiptAsPrinted,
  getReceiptsReadyToPay,
  // NEW endpoints (QUICK + barcode + commit)
  createQuickReceipt,
  generateReceiptBarcodes,
  printReceipt,
  commitReceipt,
} = require('../controllers/purchaseOrderReceiptController');


const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// 📥 POST - สร้างใบรับสินค้าใหม่ (PO)
router.post('/', createPurchaseOrderReceipt);


// 📄 GET - รายการใบรับสินค้าทั้งหมด (ตามสาขา)
router.get('/', getAllPurchaseOrderReceipts);

// 💰 GET - ดึงใบรับสินค้าที่รอการชำระเงิน (ใช้ยอดจริงจากสินค้าในใบรับ)
router.get('/ready-to-pay', getReceiptsReadyToPay);

// 📦 GET - ใบรับสินค้าพร้อมสรุปสถานะ SN (สำหรับพิมพ์บาร์โค้ด)
router.get('/with-barcode-status', getReceiptBarcodeSummaries);
// aliases for backward compatibility
router.get('/summaries', getReceiptBarcodeSummaries);
router.get('/receipt-barcode-summaries', getReceiptBarcodeSummaries);

// QUICK create (static; keep before '/:id' routes to avoid conflict)
router.post('/quick-receipts', createQuickReceipt);

// 🔍 GET - ดูรายละเอียดใบรับสินค้า
router.get('/:id', getPurchaseOrderReceiptById);

// ✏️ PUT - แก้ไขใบรับสินค้า
router.put('/:id', updatePurchaseOrderReceipt);

// 🗑️ DELETE - ลบใบรับสินค้า
router.delete('/:id', deletePurchaseOrderReceipt);

// ✅ FINALIZE (idempotent): รองรับทั้ง POST และ PATCH เพื่อความเข้ากันได้ย้อนหลัง
router.post('/:id/finalize', finalizeReceiptController);
router.patch('/:id/finalize', finalizeReceiptController);

// 🖨️ Mark printed
router.patch('/:id/printed', markPurchaseOrderReceiptAsPrinted);

// ---------- NEW: QUICK + Barcode + Commit ----------
// Generate barcodes (LOT for SIMPLE, SN for STRUCTURED)
router.post('/:id/generate-barcodes', generateReceiptBarcodes);

// Mark printed and return printable payload
router.post('/:id/print', printReceipt);

// Commit stock effects (auto-generate if missing)
router.post('/:id/commit', commitReceipt);

module.exports = router;




