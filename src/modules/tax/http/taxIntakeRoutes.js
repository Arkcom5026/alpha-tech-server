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
const {
  OUTPUT_TAX_CAPABILITY,
  allowOutputTaxCapabilities,
} = require('../authorization/outputTaxAuthorization');

const router = express.Router();
const allowOutputTaxRead = allowOutputTaxCapabilities(OUTPUT_TAX_CAPABILITY.READ);
const allowOutputTaxPrepare = allowOutputTaxCapabilities(OUTPUT_TAX_CAPABILITY.PREPARE);
const allowOutputTaxIssue = allowOutputTaxCapabilities(OUTPUT_TAX_CAPABILITY.ISSUE);
const allowOutputTaxCreditNote = allowOutputTaxCapabilities(OUTPUT_TAX_CAPABILITY.CREDIT_NOTE);
const allowOutputTaxLifecycle = allowOutputTaxCapabilities(OUTPUT_TAX_CAPABILITY.LIFECYCLE);

router.use(verifyToken);

router.use('/input-documents/overview', inputTaxOverviewRoutes);
router.use('/input-documents/pending', pendingInputTaxDocumentRoutes);
router.use('/input-documents/filing', inputTaxFilingRoutes);
router.use('/documents', inputTaxDecisionRoutes);
router.use('/documents/:taxDocumentId/receipt-links', inputTaxReceiptLinkRoutes);
router.use('/issuer-profile', taxIssuerProfileRoutes);
router.use('/output-filings', salesTaxFilingRoutes);
router.use('/publication', taxPublicationRetryRoutes);

router.post('/candidates/register', allowOutputTaxPrepare, controller.registerCandidate);
router.post('/candidates/register-sale/:saleId', allowOutputTaxPrepare, controller.registerSaleCandidate);
router.get('/candidates', allowOutputTaxRead, controller.listCandidates);
router.get('/documents', allowOutputTaxRead, controller.listDocuments);
router.get('/documents/:taxDocumentId', allowOutputTaxRead, controller.getDocumentDetail);
router.get('/documents/:taxDocumentId/printable', allowOutputTaxRead, controller.getPrintableOutputTaxDocument);
router.get('/documents/:taxDocumentId/presentation', allowOutputTaxRead, getStatutoryTaxPresentation);
router.post('/documents/:taxDocumentId/recipient/refresh', allowOutputTaxPrepare, controller.refreshDraftRecipient);
router.post('/documents/:taxDocumentId/issue', allowOutputTaxIssue, controller.issueOutputTaxDocument);
router.post('/documents/:taxDocumentId/credit-note', allowOutputTaxCreditNote, controller.issueOutputTaxCreditNote);
router.post('/credit-notes/from-sale-return/:saleReturnId', allowOutputTaxCreditNote, controller.issueOutputTaxCreditNoteForSaleReturn);
router.post('/documents/:taxDocumentId/transition', allowOutputTaxLifecycle, controller.transitionDocument);

module.exports = router;
