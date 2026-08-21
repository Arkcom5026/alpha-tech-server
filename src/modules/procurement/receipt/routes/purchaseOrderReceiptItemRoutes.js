const express = require('express');
const router = express.Router();

const addReceiptItemController = require('../item/add/addReceiptItemController');
const updateReceiptItemController = require('../item/update/updateReceiptItemController');
const deleteReceiptItemController = require('../item/delete/deleteReceiptItemController');
const listReceiptItemsController = require('../query/items/listReceiptItemsController');
const listPurchaseOrderItemsController = require('../query/po-items/listPurchaseOrderItemsController');
const {
  PURCHASE_RECEIPT_CAPABILITY,
  allowPurchaseReceiptCapabilities,
} = require('../shared/purchaseReceiptAuthorization');
const verifyToken = require('../../../../../middlewares/verifyToken');

router.use(verifyToken);

const allowReceiptAccess = allowPurchaseReceiptCapabilities(PURCHASE_RECEIPT_CAPABILITY.ACCESS);

router.post('/', allowReceiptAccess, addReceiptItemController.handle);
router.put('/update', allowReceiptAccess, updateReceiptItemController.handle);
router.patch('/update', allowReceiptAccess, updateReceiptItemController.handle);
router.get('/by-receipt/:receiptId', allowReceiptAccess, listReceiptItemsController.handle);
router.delete('/:id', allowReceiptAccess, deleteReceiptItemController.handle);

router.get('/:id/po-items', allowReceiptAccess, listPurchaseOrderItemsController.handle);
router.get('/po/:poId/items', allowReceiptAccess, listPurchaseOrderItemsController.handle);

module.exports = router;
