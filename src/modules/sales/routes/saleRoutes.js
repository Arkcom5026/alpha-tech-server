const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { completeSaleController } = require('../completion/controllers/saleCompletionController');
const { createSale } = require('../create/controllers/saleLegacyCreateController');
const { updateSaleDocumentLinesController } = require('../documents/controllers/saleDocumentController');
const {
  getSaleDeliveryNote,
  getSaleDeliveryNoteRevisions,
  createSaleDeliveryNoteRevision,
  getSaleDeliveryNoteRevision,
  getSaleDeliveryNoteRevisionPrint,
  issueSaleDeliveryNoteController,
} = require('../documents/controllers/saleDeliveryNoteController');
const {
  createSaleDocumentPreparationController,
  getSaleDocumentPreparationController,
  lockSaleDocumentPreparationController,
  registerSaleDocumentPreparationTaxCandidatesController,
  replaceSaleDocumentPreparationLinesController,
} = require('../document-preparation/documentPreparationController');
const {
  createSaleDocumentReplacementController,
  getSaleDocumentReplacementController,
  lockSaleDocumentReplacementController,
  replaceSaleDocumentReplacementLinesController,
} = require('../document-replacement/documentReplacementController');
const { getAllSales, getAllSalesReturn, getSaleById, searchPrintableSales } = require('../history/controllers/saleHistoryController');
const { searchSaleItemsController } = require('../item-search/controllers/saleItemSearchController');
const { getSaleQuotationReferenceController } = require('../lineage/saleQuotationReferenceController');
const { markSaleAsPaid } = require('../settlement/controllers/saleSettlementController');
const saleReturnRoutes = require('../return/routes/saleReturnRoutes');
const posHeldCartRoutes = require('../held-cart/routes/posHeldCartRoutes');
const quotationRoutes = require('../../quotation/http/quotationRoutes');
const {
  SALES_CAPABILITY,
  allowSalesCapabilities,
} = require('../shared/salesAuthorization');

const router = express.Router();
const allowSalesCore = allowSalesCapabilities(SALES_CAPABILITY.CORE);
const allowSalesCompletion = allowSalesCapabilities(
  SALES_CAPABILITY.CORE,
  SALES_CAPABILITY.COMPLETE,
);

router.use(verifyToken);
router.use('/quotations', quotationRoutes);
router.use('/held-carts', allowSalesCore, posHeldCartRoutes);
router.get('/items/search', allowSalesCore, searchSaleItemsController);
router.post('/complete', allowSalesCompletion, completeSaleController);
router.use('/returns', saleReturnRoutes);
router.post('/', allowSalesCore, createSale);
router.get('/', allowSalesCore, getAllSales);
router.get('/return', allowSalesCore, getAllSalesReturn);
router.get('/printable', allowSalesCore, searchPrintableSales);
router.get('/printable-sales', allowSalesCore, searchPrintableSales);
router.post('/:id/document-preparation', createSaleDocumentPreparationController);
router.get('/:id/document-preparation', getSaleDocumentPreparationController);
router.put('/:id/document-preparation/lines', replaceSaleDocumentPreparationLinesController);
router.post('/:id/document-preparation/lock', lockSaleDocumentPreparationController);
router.post('/:id/document-preparation/tax-candidates', registerSaleDocumentPreparationTaxCandidatesController);
router.post('/:id/document-replacement', createSaleDocumentReplacementController);
router.get('/:id/document-replacement', getSaleDocumentReplacementController);
router.put('/:id/document-replacement/lines', replaceSaleDocumentReplacementLinesController);
router.post('/:id/document-replacement/lock', lockSaleDocumentReplacementController);
router.put('/:id/document-lines', updateSaleDocumentLinesController);
router.post('/:id/delivery-note', issueSaleDeliveryNoteController);
router.post('/:id/delivery-note/revisions', allowSalesCore, createSaleDeliveryNoteRevision);
router.get('/:id/delivery-note/revisions', getSaleDeliveryNoteRevisions);
router.get('/:id/delivery-note/revisions/:revisionId/print', getSaleDeliveryNoteRevisionPrint);
router.get('/:id/delivery-note/revisions/:revisionId', getSaleDeliveryNoteRevision);
router.get('/:id/delivery-note', getSaleDeliveryNote);
router.get('/:id/quotation-reference', getSaleQuotationReferenceController);
router.put('/:id/document-descriptions', updateSaleDocumentLinesController);
router.get('/:id', allowSalesCore, getSaleById);
router.post('/:id/mark-paid', markSaleAsPaid);

module.exports = router;
