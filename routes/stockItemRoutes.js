




// ✅ stockItemRoutes.js — จัดการ Routing สำหรับ StockItem (SN / Barcode)

const express = require('express');
const router = express.Router();

// 🔧 Adapter: รองรับ payload ได้ทั้ง 2 แบบ
// 1) { barcode: "00225...", serialNumber?: "..." }
// 2) { barcode: { barcode: "00225...", serialNumber?: "..." } }
function normalizeReceivePayload(req, _res, next) {
  try {
    const b = req.body || {};
    if (b && typeof b === 'object') {
      if (typeof b.barcode === 'string') {
        // flat → wrap เป็น object
        req.body = { barcode: { barcode: b.barcode, serialNumber: b.serialNumber } };
      } else if (b.barcode && typeof b.barcode === 'object' && typeof b.barcode.barcode === 'string') {
        // already correct
      } else if (b.code && typeof b.code === 'string') {
        // เผื่อบางหน้าใช้ชื่อ field ว่า code
        req.body = { barcode: { barcode: b.code, serialNumber: b.serialNumber } };
      }
    }
  } catch (_) {}
  next();
}
const {
  addStockItemFromReceipt,
  markStockItemsAsSold,
  getStockItemsByReceipt,
  searchStockItem,
  deleteStockItem,
  updateStockItemStatus,
  getStockItemsByReceiptIds,
  receiveStockItem,
  updateSerialNumber,
  getAvailableStockItemsByProduct,
} = require('../controllers/stockItemController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addStockItemFromReceipt);
router.patch('/mark-sold', markStockItemsAsSold);

router.get('/by-receipt/:receiptId', getStockItemsByReceipt);
router.get('/search', searchStockItem);
router.get('/available', getAvailableStockItemsByProduct);
router.delete('/:id', deleteStockItem);
router.patch('/:id/status', updateStockItemStatus);
router.post('/by-receipt-ids', getStockItemsByReceiptIds);
// ✅ รับสินค้าเข้าสต๊อก (SN/LOT) — ใช้ adapter เพื่อรองรับ payload เก่า/ใหม่
router.post('/receive-sn', normalizeReceivePayload, receiveStockItem);
// alias เผื่อของเดิมบางส่วนเรียก /receive
router.post('/receive', normalizeReceivePayload, receiveStockItem);
router.patch('/update-sn/:barcode', updateSerialNumber);

module.exports = router;







