'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxIntakeController');
const pendingInputTaxDocumentRoutes = require('../inputDocuments/pending/pendingInputTaxDocumentRoutes');
const inputTaxReceiptLinkRoutes = require('../inputDocuments/links/inputTaxReceiptLinkRoutes');
const inputTaxOverviewRoutes = require('../inputDocuments/overview/inputTaxOverviewRoutes');
const inputTaxFilingRoutes = require('../inputDocuments/filing/inputTaxFilingRoutes');
const inputTaxDecisionRoutes = require('../inputDocuments/decisions/inputTaxDecisionRoutes');
const taxIssuerProfileRoutes = require('../issuerProfile/routes/taxIssuerProfileRoutes');
const salesTaxFilingRoutes = require('../outputDocuments/filing/salesTaxFilingRoutes');
const taxPublicationRetryRoutes = require('../publicationRetry/taxPublicationRetryRoutes');
const {
  getStatutoryTaxPresentation,
} = require('../documents/presentation/getStatutoryTaxPresentationController');

const router = express.Router();
router.use(verifyToken);

router.use('/input-documents/overview', inputTaxOverviewRoutes);
router.use('/input-documents/pending', pendingInputTaxDocumentRoutes);
router.use('/input-documents/filing', inputTaxFilingRoutes);
router.use('/documents', inputTaxDecisionRoutes);
router.use('/documents/:taxDocumentId/receipt-links', inputTaxReceiptLinkRoutes);
router.use('/issuer-profile', taxIssuerProfileRoutes);
router.use('/output-filings', salesTaxFilingRoutes);
router.use('/publication', taxPublicationRetryRoutes);

router.post('/candidates/register', controller.registerCandidate);
router.post('/candidates/register-sale/:saleId', controller.registerSaleCandidate);
router.get('/candidates', controller.listCandidates);
router.get('/documents', controller.listDocuments);
router.get('/documents/:taxDocumentId', controller.getDocumentDetail);
router.get('/documents/:taxDocumentId/printable', controller.getPrintableOutputTaxDocument);
router.get('/documents/:taxDocumentId/presentation', getStatutoryTaxPresentation);
router.post('/documents/:taxDocumentId/recipient/refresh', controller.refreshDraftRecipient);
router.post('/documents/:taxDocumentId/issue', controller.issueOutputTaxDocument);
router.post('/documents/:taxDocumentId/credit-note', controller.issueOutputTaxCreditNote);
router.post('/credit-notes/from-sale-return/:saleReturnId', controller.issueOutputTaxCreditNoteForSaleReturn);
router.post('/documents/:taxDocumentId/transition', controller.transitionDocument);

module.exports = router;
