// ✅ server/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,
  getProductPrices,
  addProductPrice,
  updateProductPrice,
  deleteProductPrice,
  searchProducts,
} = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Apply verifyToken middleware to all routes
router.use(verifyToken);

// ✅ Routes
router.get('/', getAllProducts);
router.get('/dropdowns/:id', getProductDropdowns);
router.get('/dropdowns', getProductDropdowns);
router.get('/search', searchProducts);                      // ✅ moved up before /:id
router.get('/:id/prices', getProductPrices);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.delete('/:id/image', deleteProductImage);
router.post('/:id/prices', addProductPrice);
router.put('/:productId/prices/:priceId', updateProductPrice);
router.delete('/:productId/prices/:priceId', deleteProductPrice);

module.exports = router;
