'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxIntakeController');

const router = express.Router();
router.use(verifyToken);

router.post('/candidates/register', controller.registerCandidate);
router.get('/candidates', controller.listCandidates);
router.get('/documents', controller.listDocuments);
router.get('/documents/:taxDocumentId', controller.getDocumentDetail);

module.exports = router;