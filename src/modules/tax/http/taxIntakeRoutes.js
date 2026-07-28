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
router.get('/documents/:taxDocumentId', controller.getDocumentDetail);
router.post('/documents/:taxDocumentId/transition', controller.transitionDocument);

module.exports = router;
