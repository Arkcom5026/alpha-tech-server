'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./accountingOfficePackageController');

const router = express.Router();
router.use(verifyToken);
router.get('/accounting-office/packages/:taxPeriodId', controller.getPackage);

module.exports = router;
