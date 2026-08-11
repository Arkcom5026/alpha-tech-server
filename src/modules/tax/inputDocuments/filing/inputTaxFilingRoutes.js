'use strict';

const express = require('express');
const controller = require('./inputTaxFilingController');

const router = express.Router({ mergeParams: true });

router.get('/periods/:taxPeriodId/workspace', controller.getPeriodWorkspace);
router.post('/periods/:taxPeriodId/prepare', controller.preparePeriod);
router.post('/batches/:batchId/documents/:taxDocumentId/select', controller.selectDocument);
router.post('/batches/:batchId/documents/:taxDocumentId/remove', controller.removeDocument);
router.post('/batches/:batchId/file', controller.markBatchFiled);

module.exports = router;
