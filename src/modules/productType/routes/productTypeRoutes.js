// src/modules/productType/routes/productTypeRoutes.js
// ProductType Module Routes v2

const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');

const {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
  getGlobalProductTypeOptions,
  getTemplateProductTypeOptions,
} = require('../controllers/productTypeController');

router.use(verifyToken);

// Specific routes must be declared before /:id
router.get('/dropdowns', getProductTypeDropdowns);
router.get('/global-options', getGlobalProductTypeOptions);
router.get('/template-options', getTemplateProductTypeOptions);

// Branch-owned runtime ProductType
router.get('/', getAllProductType);
router.get('/:id', getProductTypeById);

router.post('/', createProductType);
router.patch('/:id', updateProductType);
router.put('/:id', updateProductType);
router.patch('/:id/archive', archiveProductType);
router.patch('/:id/restore', restoreProductType);

module.exports = router;
