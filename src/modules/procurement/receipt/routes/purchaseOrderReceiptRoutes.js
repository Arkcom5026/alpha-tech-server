const express = require('express');
const router = express.Router();

const createPurchaseReceiptController = require('../create/createPurchaseReceiptController');
const createQuickReceiptController = require('../quick/createQuickReceiptController');
const updatePurchaseReceiptNoteController = require('../update-note/updatePurchaseReceiptNoteController');
const deletePurchaseReceiptController = require('../delete/deletePurchaseReceiptController');
const listPurchaseReceiptsController = require('../query/list/listPurchaseReceiptsController');
const getPurchaseReceiptController = require('../query/detail/getPurchaseReceiptController');
const listReceiptItemsController = require('../query/items/listReceiptItemsController');
const listReceiptsReadyToPayController = require('../query/ready-to-pay/listReceiptsReadyToPayController');
const listReceiptBarcodeSummariesController = require('../barcode/summary/listReceiptBarcodeSummariesController');
const generateReceiptBarcodesController = require('../barcode/generate/generateReceiptBarcodesController');
const markReceiptPrintedController = require('../barcode/printed/markReceiptPrintedController');
const printReceiptController = require('../barcode/print/printReceiptController');
const updateReceiptItemController = require('../item/update/updateReceiptItemController');
const finalizeReceiptController = require('../finalize/finalizeReceiptController');
const commitReceiptController = require('../commit/commitReceiptController');
const {
  PURCHASE_RECEIPT_CAPABILITY,
  allowPurchaseReceiptCapabilities,
} = require('../shared/purchaseReceiptAuthorization');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

const allowReceiptAccess = allowPurchaseReceiptCapabilities(PURCHASE_RECEIPT_CAPABILITY.ACCESS);
const allowReceiptFinalize = allowPurchaseReceiptCapabilities(
  PURCHASE_RECEIPT_CAPABILITY.ACCESS,
  PURCHASE_RECEIPT_CAPABILITY.FINALIZE,
);

router.post('/', allowReceiptAccess, createPurchaseReceiptController.handle);
router.get('/', allowReceiptAccess, listPurchaseReceiptsController.handle);
router.get('/ready-to-pay', allowReceiptAccess, listReceiptsReadyToPayController.handle);
router.get('/with-barcode-status', allowReceiptAccess, listReceiptBarcodeSummariesController.handle);
router.get('/summaries', allowReceiptAccess, listReceiptBarcodeSummariesController.handle);
router.get('/receipt-barcode-summaries', allowReceiptAccess, listReceiptBarcodeSummariesController.handle);
router.post('/quick-receipts', allowReceiptAccess, createQuickReceiptController.handle);
router.get('/:id', allowReceiptAccess, getPurchaseReceiptController.handle);
router.get('/:receiptId/items', allowReceiptAccess, listReceiptItemsController.handle);

router.patch('/:receiptId/items/:itemId', allowReceiptAccess, (req, res) => {
  req.body = {
    ...(req.body || {}),
    receiptId: Number(req.params.receiptId),
    purchaseOrderItemId: Number(req.params.itemId),
  };
  return updateReceiptItemController.handle(req, res);
});

router.put('/:id', allowReceiptAccess, updatePurchaseReceiptNoteController.handle);
router.delete('/:id', allowReceiptFinalize, deletePurchaseReceiptController.handle);
router.post('/:id/finalize', allowReceiptFinalize, finalizeReceiptController.handle);
router.patch('/:id/finalize', allowReceiptFinalize, finalizeReceiptController.handle);
router.patch('/:id/printed', allowReceiptAccess, markReceiptPrintedController.handle);
router.post('/:id/generate-barcodes', allowReceiptAccess, generateReceiptBarcodesController.handle);
router.post('/:id/print', allowReceiptAccess, printReceiptController.handle);
router.post('/:id/commit', allowReceiptFinalize, commitReceiptController.handle);

module.exports = router;
