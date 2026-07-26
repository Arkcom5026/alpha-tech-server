// purchaseOrderReceiptItemRoutes.js
const express = require('express');
const router = express.Router();

const addReceiptItemController = require('../src/modules/procurement/receipt/item/add/addReceiptItemController');
const updateReceiptItemController = require('../src/modules/procurement/receipt/item/update/updateReceiptItemController');
const deleteReceiptItemController = require('../src/modules/procurement/receipt/item/delete/deleteReceiptItemController');
const listReceiptItemsController = require('../src/modules/procurement/receipt/query/items/listReceiptItemsController');
const listPurchaseOrderItemsController = require('../src/modules/procurement/receipt/query/po-items/listPurchaseOrderItemsController');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.post('/', addReceiptItemController.handle);
router.put('/update', updateReceiptItemController.handle);
router.patch('/update', updateReceiptItemController.handle);
router.get('/by-receipt/:receiptId', listReceiptItemsController.handle);
router.delete('/:id', deleteReceiptItemController.handle);

// Legacy route kept for backward compatibility.
router.get('/:id/po-items', listPurchaseOrderItemsController.handle);
// Preferred explicit route.
router.get('/po/:poId/items', listPurchaseOrderItemsController.handle);

module.exports = router;
