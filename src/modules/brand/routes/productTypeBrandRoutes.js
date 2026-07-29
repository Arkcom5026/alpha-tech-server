// src/modules/brand/routes/productTypeBrandRoutes.js
// Backward-compatible public route wrapper owned by the Brand module.
// Preserve /api/product-type-brands while canonical business logic remains in Brand.

const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');
const {
  listProductTypeBrands,
  attachBrandToProductType,
  detachBrandFromProductType,
} = require('../controllers/brandController');

router.use(verifyToken);

router.get('/', listProductTypeBrands);
router.post('/', attachBrandToProductType);
router.delete('/:id', detachBrandFromProductType);

module.exports = router;
