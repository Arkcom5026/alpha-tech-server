const express = require('express');
const router = express.Router();

const {
  addressController: { resolve, validate, postcode, search, join },
} = require('../controllers/addressController');

// Public endpoints — no auth middleware
router.get('/resolve',  resolve);
router.get('/validate', validate);
router.get('/postcode', postcode);
router.get('/search',   search);
router.post('/join',    join);

module.exports = router;


