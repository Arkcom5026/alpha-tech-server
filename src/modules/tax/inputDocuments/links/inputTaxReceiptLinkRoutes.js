'use strict';

const express = require('express');
const controller = require('./inputTaxReceiptLinkController');

const router = express.Router({ mergeParams: true });
router.get('/', controller.list);
router.post('/', controller.attach);
router.patch('/:linkId', controller.reallocate);
router.post('/:linkId/cancel', controller.cancel);

module.exports = router;
