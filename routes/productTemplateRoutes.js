// ✅ routes/productTemplateRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
  deleteProductTemplate,
} = require('../controllers/productTemplateController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getAllProductTemplates);
router.get('/:id', getProductTemplateById);
router.post('/', createProductTemplate);
router.put('/:id', updateProductTemplate);
router.delete('/:id', deleteProductTemplate);

module.exports = router;
