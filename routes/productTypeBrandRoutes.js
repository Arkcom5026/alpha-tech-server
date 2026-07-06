// routes/productTypeBrandRoutes.js
// Backward-compatible route wrapper.
// New canonical implementation lives in: src/modules/brand

const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
const {
  listProductTypeBrands,
  attachBrandToProductType,
  detachBrandFromProductType,
} = require('../src/modules/brand/controllers/brandController');

router.use(verifyToken);

router.get('/', listProductTypeBrands);
router.post('/', attachBrandToProductType);
router.delete('/:id', detachBrandFromProductType);

module.exports = router;
