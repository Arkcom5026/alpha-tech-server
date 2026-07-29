const express = require('express');
const router = express.Router();

const addReceiptItemController = require('../item/add/addReceiptItemController');
const updateReceiptItemController = require('../item/update/updateReceiptItemController');
const deleteReceiptItemController = require('../item/delete/deleteReceiptItemController');
const listReceiptItemsController = require('../query/items/listReceiptItemsController');
const listPurchaseOrderItemsController = require('../query/po-items/listPurchaseOrderItemsController');
const verifyToken = require('../../../../../middlewares/verifyToken');

router.use(verifyToken);

router.post('/', addReceiptItemController.handle);
router.put('/update', updateReceiptItemController.handle);
router.patch('/update', updateReceiptItemController.handle);
router.get('/by-receipt/:receiptId', listReceiptItemsController.handle);
router.delete('/:id', deleteReceiptItemController.handle);

router.get('/:id/po-items', listPurchaseOrderItemsController.handle);
router.get('/po/:poId/items', listPurchaseOrderItemsController.handle);

module.exports = router;
