const express = require('express');
const router = express.Router();
const {
  createSale,
  getAllSales,
  getSaleById,
  markSaleAsPaid,
  getAllSalesReturn,
  searchPrintableSales,
  updateSaleDocumentLinesController,
} = require('../compatibility/saleLegacyCompatibilityController');
const {
  completeSaleController,
} = require('../completion/controllers/saleCompletionController');
const verifyToken = require('../../../../middlewares/verifyToken');

router.use(verifyToken);
router.post('/complete', completeSaleController);
router.post('/', createSale);
router.get('/', getAllSales);
router.get('/return', getAllSalesReturn);
router.get('/printable', searchPrintableSales);
router.get('/printable-sales', searchPrintableSales);
router.put('/:id/document-lines', updateSaleDocumentLinesController);
router.put('/:id/document-descriptions', updateSaleDocumentLinesController);
router.get('/:id', getSaleById);
router.post('/:id/mark-paid', markSaleAsPaid);

module.exports = router;
