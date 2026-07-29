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

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', createPurchaseReceiptController.handle);
router.get('/', listPurchaseReceiptsController.handle);
router.get('/ready-to-pay', listReceiptsReadyToPayController.handle);
router.get('/with-barcode-status', listReceiptBarcodeSummariesController.handle);
router.get('/summaries', listReceiptBarcodeSummariesController.handle);
router.get('/receipt-barcode-summaries', listReceiptBarcodeSummariesController.handle);
router.post('/quick-receipts', createQuickReceiptController.handle);
router.get('/:id', getPurchaseReceiptController.handle);
router.get('/:receiptId/items', listReceiptItemsController.handle);

router.patch('/:receiptId/items/:itemId', (req, res) => {
  req.body = {
    ...(req.body || {}),
    receiptId: Number(req.params.receiptId),
    purchaseOrderItemId: Number(req.params.itemId),
  };
  return updateReceiptItemController.handle(req, res);
});

router.put('/:id', updatePurchaseReceiptNoteController.handle);
router.delete('/:id', deletePurchaseReceiptController.handle);
router.post('/:id/finalize', finalizeReceiptController.handle);
router.patch('/:id/finalize', finalizeReceiptController.handle);
router.patch('/:id/printed', markReceiptPrintedController.handle);
router.post('/:id/generate-barcodes', generateReceiptBarcodesController.handle);
router.post('/:id/print', printReceiptController.handle);
router.post('/:id/commit', commitReceiptController.handle);

module.exports = router;
