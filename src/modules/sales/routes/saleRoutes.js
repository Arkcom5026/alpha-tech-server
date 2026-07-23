const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { completeSaleController } = require('../completion/controllers/saleCompletionController');
const { createSale } = require('../create/controllers/saleLegacyCreateController');
const { updateSaleDocumentLinesController } = require('../documents/controllers/saleDocumentController');
const { getAllSales, getAllSalesReturn, getSaleById, searchPrintableSales } = require('../history/controllers/saleHistoryController');
const { markSaleAsPaid } = require('../settlement/controllers/saleSettlementController');
const saleReturnRoutes = require('../return/routes/saleReturnRoutes');

const router = express.Router();
router.use(verifyToken);
router.post('/complete', completeSaleController);
router.use('/returns', saleReturnRoutes);
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
