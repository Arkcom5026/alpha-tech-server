// src/modules/location/routes/addressRoutes.js
const express = require('express');
const router = express.Router();

const addressListController = require('../address/list/addressListController');
const { addressController } = require('../../../../controllers/addressController');

router.get('/provinces', addressListController.listProvinces);
router.get('/districts', addressListController.listDistricts);
router.get('/subdistricts', addressListController.listSubdistricts);

router.get('/resolve', addressController.resolve);
router.get('/validate', addressController.validate);
router.get('/postcode', addressController.postcode);
router.get('/search', addressController.search);
router.post('/join', addressController.join);

module.exports = router;
