// ✅ stockItemRoutes.js — จัดการ Routing สำหรับ StockItem (SN / Barcode)

const express = require('express');
const router = express.Router();

const { getStockItemsByReceipt,
    getStockItemsByProduct,
    deleteStockItem,
    updateStockItemStatus,
    addStockItemFromReceipt,
    getStockItemsForBarcodePrint
} = require('../controllers/StockItemController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addStockItemFromReceipt);
router.get('/by-receipt/:receiptId', getStockItemsByReceipt);
            
router.get('/by-product/:productId', getStockItemsByProduct);
router.delete('/:id', deleteStockItem);
router.patch('/:id/status', updateStockItemStatus);
router.get('/for-barcode-print', getStockItemsForBarcodePrint);

module.exports = router;
