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
  
} = require('../controllers/purchaseOrderReceiptController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);


// 📥 POST - สร้างใบรับสินค้าใหม่
router.post('/', createPurchaseOrderReceipt);

// 📄 GET - รายการใบรับสินค้าทั้งหมด (ตามสาขา)
router.get('/', getAllPurchaseOrderReceipts);

// 💰 GET - ดึงใบรับสินค้าที่รอการชำระเงิน (ใช้ยอดจริงจากสินค้าในใบรับ)
router.get('/ready-to-pay', getReceiptsReadyToPay);

// 📦 GET - ใบรับสินค้าพร้อมสรุปสถานะ SN (สำหรับพิมพ์บาร์โค้ด)
router.get('/with-barcode-status', getReceiptBarcodeSummaries);

// 🔍 GET - ดูรายละเอียดใบรับสินค้า
router.get('/:id', getPurchaseOrderReceiptById);

// ✏️ PUT - แก้ไขใบรับสินค้า
router.put('/:id', updatePurchaseOrderReceipt);

// 🗑️ DELETE - ลบใบรับสินค้า
router.delete('/:id', deletePurchaseOrderReceipt);

// ✅ PATCH - ตรวจสอบและปรับสถานะใบรับสินค้า + ตัดเครดิต
router.patch('/:id/finalize', finalizeReceiptController);

router.patch('/:id/printed', markPurchaseOrderReceiptAsPrinted);



module.exports = router;
