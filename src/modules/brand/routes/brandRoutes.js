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
} = require('../controllers/brandController');

router.use(verifyToken);

// Brand-owned options for Brand page.
// This endpoint exists to keep Brand FE self-contained and avoid importing ProductType FE store/api.
router.get('/product-type-options', listProductTypeOptions);

// Brand read/dropdown
router.get('/dropdowns', listBrandDropdowns);
router.get('/', listBrands);

// Brand master data
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.patch('/:id/toggle', toggleBrand);

// ProductTypeBrand mapping under Brand module
router.get('/product-type-brands', listProductTypeBrands);
router.post('/product-type-brands', attachBrandToProductType);
router.delete('/product-type-brands/:id', detachBrandFromProductType);

module.exports = router;
