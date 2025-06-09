// ✅ stockItemRoutes.js — จัดการ Routing สำหรับ StockItem (SN / Barcode)

const express = require('express');
const router = express.Router();

const {
  getStockItemsByReceipt,
  deleteStockItem,
  updateStockItemStatus,
  addStockItemFromReceipt,
  getStockItemsByReceiptIds,
  receiveStockItem,
  searchStockItem,
  markStockItemsAsSold, // ✅ ใช้ตัวเดียวสำหรับทุกกรณี (barcode, title, code)
} = require('../controllers/StockItemController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addStockItemFromReceipt);
router.get('/by-receipt/:receiptId', getStockItemsByReceipt);
router.get('/search', searchStockItem); // ✅ เหลือ route นี้เท่านั้นสำหรับค้นหา
router.delete('/:id', deleteStockItem);
router.patch('/:id/status', updateStockItemStatus);
router.post('/by-receipt-ids', getStockItemsByReceiptIds);
router.post('/receive-sn', receiveStockItem);
router.patch('/mark-sold', markStockItemsAsSold);

module.exports = router;
