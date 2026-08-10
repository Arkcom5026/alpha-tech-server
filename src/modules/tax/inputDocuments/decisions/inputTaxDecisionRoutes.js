'use strict';

const express = require('express');
const controller = require('./inputTaxDecisionController');

const router = express.Router({ mergeParams: true });

router.post('/:taxDocumentId/duplicate-decision', controller.decideDuplicate);
router.post('/:taxDocumentId/replacement-link', controller.linkReplacement);

module.exports = router;
