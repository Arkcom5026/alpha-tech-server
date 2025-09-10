const express = require('express');
const router = express.Router();

const {
  addressController: {
    resolve,
    validate,
    postcode,
    search,
    join,
    listProvinces,
    listDistricts,
    listSubdistricts,
  },
} = require('../controllers/addressController');

// Public endpoints — no auth middleware
// Lookup lists used by FE (CustomerSection / BranchForm)
router.get('/provinces', listProvinces);
router.get('/districts', listDistricts);
router.get('/subdistricts', listSubdistricts);

// Utilities
router.get('/resolve',  resolve);
router.get('/validate', validate);
router.get('/postcode', postcode);
router.get('/search',   search);
router.post('/join',    join);

module.exports = router;




