// purchaseOrderReceiptItemRoutes.js
const express = require('express');
const router = express.Router();
const { getPOItemsByPOId } = require('../controllers/purchaseOrderReceiptItemController');
const addReceiptItemController = require('../src/modules/procurement/receipt/item/add/addReceiptItemController');
const updateReceiptItemController = require('../src/modules/procurement/receipt/item/update/updateReceiptItemController');
const listReceiptItemsController = require('../src/modules/procurement/receipt/query/items/listReceiptItemsController');
const deleteReceiptItemController = require('../src/modules/procurement/receipt/item/delete/deleteReceiptItemController');
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', addReceiptItemController.handle);
router.put('/update', updateReceiptItemController.handle);
router.patch('/update', updateReceiptItemController.handle);
router.get('/by-receipt/:receiptId', listReceiptItemsController.handle);

router.delete('/:id', deleteReceiptItemController.handle);
// ✅ Legacy route (kept for backward compatibility)
router.get('/:id/po-items', getPOItemsByPOId);
// ✅ Preferred explicit route
router.get('/po/:poId/items', getPOItemsByPOId);

module.exports = router;
