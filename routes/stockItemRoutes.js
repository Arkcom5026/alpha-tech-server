// ✅ stockItemRoutes.js — จัดการ Routing สำหรับ StockItem (SN / Barcode)

const express = require('express');
const router = express.Router();
const { addStockItemFromReceipt,
  markStockItemsAsSold,
  getStockItemsByReceipt,
  searchStockItem,
  deleteStockItem,
  updateStockItemStatus,
  getStockItemsByReceiptIds,
  receiveStockItem, updateSerialNumber
} = require('../controllers/stockItemController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addStockItemFromReceipt);
router.patch('/mark-sold', markStockItemsAsSold);

router.get('/by-receipt/:receiptId', getStockItemsByReceipt);
router.get('/search', searchStockItem); // ✅ เหลือ route นี้เท่านั้นสำหรับค้นหา
router.delete('/:id', deleteStockItem);
router.patch('/:id/status', updateStockItemStatus);
router.post('/by-receipt-ids', getStockItemsByReceiptIds);
router.post('/receive-sn', receiveStockItem);
router.patch('/update-sn/:barcode', updateSerialNumber);


module.exports = router;
