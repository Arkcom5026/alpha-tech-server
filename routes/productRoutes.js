// ✅ server/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  createProduct,
  updateProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
} = require('../controllers/productController');

router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.get('/products', getAllProducts);
router.get('/products/:id', getProductById);
router.delete('/products/:id', deleteProduct);

module.exports = router;
