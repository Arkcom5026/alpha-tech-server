// src/modules/location/routes/addressRoutes.js
const express = require('express');
const router = express.Router();

const { addressController } = require('../../../../controllers/addressController');

router.get('/provinces', addressController.listProvinces);
router.get('/districts', addressController.listDistricts);
router.get('/subdistricts', addressController.listSubdistricts);

router.get('/resolve', addressController.resolve);
router.get('/validate', addressController.validate);
router.get('/postcode', addressController.postcode);
router.get('/search', addressController.search);
router.post('/join', addressController.join);

module.exports = router;
