'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxIntakeController');
const pendingInputTaxDocumentRoutes = require('../inputDocuments/pending/pendingInputTaxDocumentRoutes');
const inputTaxReceiptLinkRoutes = require('../inputDocuments/links/inputTaxReceiptLinkRoutes');

const router = express.Router();
router.use(verifyToken);

router.use('/input-documents/pending', pendingInputTaxDocumentRoutes);
router.use('/documents/:taxDocumentId/receipt-links', inputTaxReceiptLinkRoutes);

router.post('/candidates/register', controller.registerCandidate);
router.post('/candidates/register-sale/:saleId', controller.registerSaleCandidate);
router.get('/candidates', controller.listCandidates);
router.get('/documents', controller.listDocuments);
router.get('/documents/:taxDocumentId/workspace', controller.getDocumentWorkspaceProjection);
router.get('/documents/:taxDocumentId/operational-readiness', controller.getDocumentOperationalReadinessProjection);
router.get('/documents/:taxDocumentId/print-projection', controller.getDocumentPrintProjection);
router.get('/documents/:taxDocumentId/timeline', controller.getDocumentTimelineProjection);
router.get('/documents/:taxDocumentId/replacement-chain', controller.getDocumentReplacementChainProjection);
router.get('/documents/:taxDocumentId', controller.getDocumentDetail);
router.post('/documents/:taxDocumentId/issue', controller.issueDocument);
router.post('/documents/:taxDocumentId/cancel', controller.cancelDocument);
router.post('/documents/:taxDocumentId/replace', controller.replaceDocument);
router.post('/documents/:taxDocumentId/transition', controller.transitionDocument);

module.exports = router;
