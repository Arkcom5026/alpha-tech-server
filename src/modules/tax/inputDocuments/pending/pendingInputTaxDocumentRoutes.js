'use strict';

const express = require('express');
const controller = require('./pendingInputTaxDocumentController');
const router = express.Router();
router.get('/', controller.list);
module.exports = router;
