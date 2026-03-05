// routes/purchaseReportRoutes.js

const express = require('express');
const router = express.Router();

const {
  getPurchaseReport, // ✅ line-level (เดิม) : 1 แถว = 1 รายการสินค้า
  getPurchaseReceiptReport, // ✅ summary (ใหม่) : 1 แถว = 1 ใบรับ (RC)
  getPurchaseReceiptReportDetail, // ✅ detail (ใหม่) : รายการของใบเดียว
} = require('../controllers/purchaseReportController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ GET: รายงานการจัดซื้อ (เดิม - line-level)
// GET /api/purchase-reports?dateFrom&dateTo&supplierId&receiptStatus&paymentStatus&productId
router.get('/', getPurchaseReport);

// ✅ GET: รายงานการจัดซื้อแบบรวมเป็นใบ (ใหม่ - receipt-level summary)
// GET /api/purchase-reports/receipts?dateFrom&dateTo&supplierId&receiptStatus&paymentStatus&productId
router.get('/receipts', getPurchaseReceiptReport);

// ✅ GET: รายงานการจัดซื้อรายละเอียดใบ (ใหม่ - receipt detail)
// GET /api/purchase-reports/receipts/:receiptId
router.get('/receipts/:receiptId', getPurchaseReceiptReportDetail);

module.exports = router;