'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./taxIssuerProfileController');

const router = express.Router();
router.use(verifyToken);

router.get('/', controller.getCurrentTaxIssuerProfile);
router.put('/', controller.upsertCurrentTaxIssuerProfile);

module.exports = router;
