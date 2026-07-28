'use strict';

const express = require('express');
const controller = require('./inputTaxOverviewController');

const router = express.Router();
router.get('/', controller.get);

module.exports = router;
