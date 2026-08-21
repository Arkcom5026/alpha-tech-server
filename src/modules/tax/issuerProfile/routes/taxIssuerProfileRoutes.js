'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./taxIssuerProfileController');
const {
  TAX_ISSUER_PROFILE_CAPABILITY,
  allowTaxIssuerProfileCapabilities,
} = require('../taxIssuerProfileAuthorization');

const router = express.Router();
router.use(verifyToken);

const allowTaxIssuerProfileRead = allowTaxIssuerProfileCapabilities(
  TAX_ISSUER_PROFILE_CAPABILITY.READ,
);
const allowTaxIssuerProfileManage = allowTaxIssuerProfileCapabilities(
  TAX_ISSUER_PROFILE_CAPABILITY.READ,
  TAX_ISSUER_PROFILE_CAPABILITY.MANAGE,
);

router.get('/', allowTaxIssuerProfileRead, controller.getCurrentTaxIssuerProfile);
router.put('/', allowTaxIssuerProfileManage, controller.upsertCurrentTaxIssuerProfile);

module.exports = router;
