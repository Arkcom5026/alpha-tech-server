// ✅ server/routes/productTemplateRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  deleteProductTemplate,
  getProductTemplateById,
} = require('../controllers/productTemplateController');

router.get('/', getAllProductTemplates);
router.post('/', createProductTemplate);
router.put('/:id', updateProductTemplate);
router.delete('/:id', deleteProductTemplate);
router.get('/:id', getProductTemplateById);

module.exports = router;