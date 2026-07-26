// purchaseOrderReceiptRoutes.js

const express = require('express');
const router = express.Router();

const {
  finalizeReceiptController,
  getReceiptsReadyToPay,
  commitReceipt,
} = require('../controllers/purchaseOrderReceiptController');

const createPurchaseReceiptController = require('../src/modules/procurement/receipt/create/createPurchaseReceiptController');
const createQuickReceiptController = require('../src/modules/procurement/receipt/quick/createQuickReceiptController');
const updatePurchaseReceiptNoteController = require('../src/modules/procurement/receipt/update-note/updatePurchaseReceiptNoteController');
const deletePurchaseReceiptController = require('../src/modules/procurement/receipt/delete/deletePurchaseReceiptController');
const listPurchaseReceiptsController = require('../src/modules/procurement/receipt/query/list/listPurchaseReceiptsController');
const getPurchaseReceiptController = require('../src/modules/procurement/receipt/query/detail/getPurchaseReceiptController');
const listReceiptItemsController = require('../src/modules/procurement/receipt/query/items/listReceiptItemsController');
const listReceiptBarcodeSummariesController = require('../src/modules/procurement/receipt/barcode/summary/listReceiptBarcodeSummariesController');
const generateReceiptBarcodesController = require('../src/modules/procurement/receipt/barcode/generate/generateReceiptBarcodesController');
const markReceiptPrintedController = require('../src/modules/procurement/receipt/barcode/printed/markReceiptPrintedController');
const printReceiptController = require('../src/modules/procurement/receipt/barcode/print/printReceiptController');
const updateReceiptItemController = require('../src/modules/procurement/receipt/item/update/updateReceiptItemController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', createPurchaseReceiptController.handle);
router.get('/', listPurchaseReceiptsController.handle);
router.get('/ready-to-pay', getReceiptsReadyToPay);
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
router.post('/:id/finalize', finalizeReceiptController);
router.patch('/:id/finalize', finalizeReceiptController);
router.patch('/:id/printed', markReceiptPrintedController.handle);
router.post('/:id/generate-barcodes', generateReceiptBarcodesController.handle);
router.post('/:id/print', printReceiptController.handle);
router.post('/:id/commit', commitReceipt);

module.exports = router;
