// purchaseOrderReceiptRoutes.js

const express = require('express');
const router = express.Router();

const {
  getReceiptBarcodeSummaries,
  finalizeReceiptController,
  markPurchaseOrderReceiptAsPrinted,
  getReceiptsReadyToPay,
  createQuickReceipt,
  generateReceiptBarcodes,
  printReceipt,
  commitReceipt,
} = require('../controllers/purchaseOrderReceiptController');

const createPurchaseReceiptController = require('../src/modules/procurement/receipt/create/createPurchaseReceiptController');
const updatePurchaseReceiptNoteController = require('../src/modules/procurement/receipt/update-note/updatePurchaseReceiptNoteController');
const deletePurchaseReceiptController = require('../src/modules/procurement/receipt/delete/deletePurchaseReceiptController');
const listPurchaseReceiptsController = require('../src/modules/procurement/receipt/query/list/listPurchaseReceiptsController');
const getPurchaseReceiptController = require('../src/modules/procurement/receipt/query/detail/getPurchaseReceiptController');
const listReceiptItemsController = require('../src/modules/procurement/receipt/query/items/listReceiptItemsController');
const updateReceiptItemController = require('../src/modules/procurement/receipt/item/update/updateReceiptItemController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', createPurchaseReceiptController.handle);
router.get('/', listPurchaseReceiptsController.handle);
router.get('/ready-to-pay', getReceiptsReadyToPay);
router.get('/with-barcode-status', getReceiptBarcodeSummaries);
router.get('/summaries', getReceiptBarcodeSummaries);
router.get('/receipt-barcode-summaries', getReceiptBarcodeSummaries);
router.post('/quick-receipts', createQuickReceipt);
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
router.patch('/:id/printed', markPurchaseOrderReceiptAsPrinted);
router.post('/:id/generate-barcodes', generateReceiptBarcodes);
router.post('/:id/print', printReceipt);
router.post('/:id/commit', commitReceipt);

module.exports = router;
