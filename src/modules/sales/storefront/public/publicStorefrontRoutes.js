'use strict';

const express = require('express');
const { getPublicStorefrontController } = require('./publicStorefrontController');

const router = express.Router();
router.get('/:slug', getPublicStorefrontController);

module.exports = router;
