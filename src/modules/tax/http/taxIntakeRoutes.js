'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxIntakeController');
const pendingInputTaxDocumentRoutes = require('../inputDocuments/pending/pendingInputTaxDocumentRoutes');
const inputTaxReceiptLinkRoutes = require('../inputDocuments/links/inputTaxReceiptLinkRoutes');
const inputTaxOverviewRoutes = require('../inputDocuments/overview/inputTaxOverviewRoutes');
const taxIssuerProfileRoutes = require('../issuerProfile/routes/taxIssuerProfileRoutes');

const router = express.Router();
router.use(verifyToken);

router.use('/input-documents/overview', inputTaxOverviewRoutes);
router.use('/input-documents/pending', pendingInputTaxDocumentRoutes);
router.use('/documents/:taxDocumentId/receipt-links', inputTaxReceiptLinkRoutes);
router.use('/issuer-profile', taxIssuerProfileRoutes);

router.post('/candidates/register', controller.registerCandidate);
router.post('/candidates/register-sale/:saleId', controller.registerSaleCandidate);
router.post('/candidates/register-sale-return/:saleReturnId', controller.registerSaleReturnCandidate);
router.get('/candidates', controller.listCandidates);
router.get('/documents', controller.listDocuments);
router.get('/documents/:taxDocumentId', controller.getDocumentDetail);
router.post('/documents/:taxDocumentId/transition', controller.transitionDocument);

module.exports = router;
