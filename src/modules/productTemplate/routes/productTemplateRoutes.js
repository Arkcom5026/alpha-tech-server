// src/modules/productTemplate/routes/productTemplateRoutes.js
// Mission C — Template Catalog Routes

const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

const {
  getAllProductTemplates,
  getProductTemplateById,
  createProductTemplate,
  updateProductTemplate,
  archiveProductTemplate,
  restoreProductTemplate,
  toggleProductTemplateActive,
} = require('../controllers/productTemplateController');

router.use(verifyToken);

router.get('/', getAllProductTemplates);
router.get('/:id', getProductTemplateById);

router.post('/', requireAdmin, createProductTemplate);
router.patch('/:id', requireAdmin, updateProductTemplate);
router.patch('/:id/archive', requireAdmin, archiveProductTemplate);
router.patch('/:id/restore', requireAdmin, restoreProductTemplate);
router.patch('/:id/toggle-active', requireAdmin, toggleProductTemplateActive);

module.exports = router;
