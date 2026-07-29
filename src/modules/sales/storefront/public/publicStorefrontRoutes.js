'use strict';

const express = require('express');
const {
  getPublicStorefrontController,
  listPublicStorefrontProductsController,
  getPublicStorefrontProductController,
} = require('./publicStorefrontController');

const router = express.Router();
router.get('/:slug', getPublicStorefrontController);
router.get('/:slug/products', listPublicStorefrontProductsController);
router.get('/:slug/products/:productId', getPublicStorefrontProductController);

module.exports = router;
