// src/modules/brand/routes/brandRoutes.js
// Brand Module Routes

const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');

const {
  listProductTypeOptions,
  listBrands,
  listBrandDropdowns,
  createBrand,
  updateBrand,
  toggleBrand,
  listProductTypeBrands,
  attachBrandToProductType,
  detachBrandFromProductType,
} = require('../runtime/brandRuntimeController');

router.use(verifyToken);

router.get('/product-type-options', listProductTypeOptions);
router.get('/dropdowns', listBrandDropdowns);
router.get('/', listBrands);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.patch('/:id/toggle', toggleBrand);
router.get('/product-type-brands', listProductTypeBrands);
router.post('/product-type-brands', attachBrandToProductType);
router.delete('/product-type-brands/:id', detachBrandFromProductType);

module.exports = router;
