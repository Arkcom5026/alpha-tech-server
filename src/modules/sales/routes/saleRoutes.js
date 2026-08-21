const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { completeSaleController } = require('../completion/controllers/saleCompletionController');
const { createSale } = require('../create/controllers/saleLegacyCreateController');
const { updateSaleDocumentLinesController } = require('../documents/controllers/saleDocumentController');
const { getSaleDeliveryNote, issueSaleDeliveryNoteController } = require('../documents/controllers/saleDeliveryNoteController');
const {
  SALES_DOCUMENT_CAPABILITY,
  allowSalesDocumentCapabilities,
} = require('../documents/shared/salesDocumentAuthorization');
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
const { requireSaleSettlementClose } = require('../settlement/shared/saleSettlementAuthorization');
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
const allowDocumentPreparation = allowSalesDocumentCapabilities(
  SALES_DOCUMENT_CAPABILITY.PREPARE,
);
const allowDocumentPreparationLock = allowSalesDocumentCapabilities(
  SALES_DOCUMENT_CAPABILITY.PREPARE,
  SALES_DOCUMENT_CAPABILITY.LOCK,
);
const allowDocumentTaxPublish = allowSalesDocumentCapabilities(
  SALES_DOCUMENT_CAPABILITY.PREPARE,
  SALES_DOCUMENT_CAPABILITY.TAX_PUBLISH,
);
const allowDocumentReplacement = allowSalesDocumentCapabilities(
  SALES_DOCUMENT_CAPABILITY.REPLACE,
);
const allowDocumentReplacementLock = allowSalesDocumentCapabilities(
  SALES_DOCUMENT_CAPABILITY.REPLACE,
  SALES_DOCUMENT_CAPABILITY.LOCK,
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
router.post('/:id/document-preparation', allowDocumentPreparation, createSaleDocumentPreparationController);
router.get('/:id/document-preparation', allowDocumentPreparation, getSaleDocumentPreparationController);
router.put('/:id/document-preparation/lines', allowDocumentPreparation, replaceSaleDocumentPreparationLinesController);
router.post('/:id/document-preparation/lock', allowDocumentPreparationLock, lockSaleDocumentPreparationController);
router.post('/:id/document-preparation/tax-candidates', allowDocumentTaxPublish, registerSaleDocumentPreparationTaxCandidatesController);
router.post('/:id/document-replacement', allowDocumentReplacement, createSaleDocumentReplacementController);
router.get('/:id/document-replacement', allowDocumentReplacement, getSaleDocumentReplacementController);
router.put('/:id/document-replacement/lines', allowDocumentReplacement, replaceSaleDocumentReplacementLinesController);
router.post('/:id/document-replacement/lock', allowDocumentReplacementLock, lockSaleDocumentReplacementController);
router.put('/:id/document-lines', allowDocumentPreparation, updateSaleDocumentLinesController);
router.post('/:id/delivery-note', issueSaleDeliveryNoteController);
router.get('/:id/delivery-note', getSaleDeliveryNote);
router.get('/:id/quotation-reference', getSaleQuotationReferenceController);
router.put('/:id/document-descriptions', allowDocumentPreparation, updateSaleDocumentLinesController);
router.get('/:id', allowSalesCore, getSaleById);
router.post('/:id/mark-paid', requireSaleSettlementClose, markSaleAsPaid);

module.exports = router;
