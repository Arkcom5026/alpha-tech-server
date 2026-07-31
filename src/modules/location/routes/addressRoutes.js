// src/modules/location/routes/addressRoutes.js
const express = require('express');
const router = express.Router();

const addressListController = require('../address/list/addressListController');
const addressResolveController = require('../address/query/resolve/addressResolveController');
const addressValidateController = require('../address/query/validate/addressValidateController');
const addressPostcodeController = require('../address/query/postcode/addressPostcodeController');
const addressSearchController = require('../address/query/search/addressSearchController');
const { addressController } = require('../../../../controllers/addressController');

router.get('/provinces', addressListController.listProvinces);
router.get('/districts', addressListController.listDistricts);
router.get('/subdistricts', addressListController.listSubdistricts);

router.get('/resolve', addressResolveController.resolveAddress);
router.get('/validate', addressValidateController.validateAddress);
router.get('/postcode', addressPostcodeController.postcodeAddress);
router.get('/search', addressSearchController.searchAddress);
router.post('/join', addressController.join);

module.exports = router;
