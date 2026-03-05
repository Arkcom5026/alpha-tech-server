

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

// ✅ Receipt items endpoints (bridge to REST-style routes)
const {
  updateReceiptItem,
  getReceiptItemsByReceiptId,
} = require('../controllers/purchaseOrderReceiptItemController');


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

// ✅ REST-style items (preferred) — keeps FE stable
// List items of a receipt
router.get('/:receiptId/items', (req, res) => {
  // reuse existing controller which expects :receiptId in params
  req.params.receiptId = req.params.receiptId;
  return getReceiptItemsByReceiptId(req, res);
});

// Update a single receipt item (maps to legacy update body)
router.patch('/:receiptId/items/:itemId', (req, res) => {
  // Legacy controller expects { receiptId, purchaseOrderItemId } in body
  req.body = {
    ...(req.body || {}),
    receiptId: Number(req.params.receiptId),
    purchaseOrderItemId: Number(req.params.itemId),
  };
  return updateReceiptItem(req, res);
});

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





