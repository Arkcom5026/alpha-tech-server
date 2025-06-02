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
} = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Apply verifyToken middleware to all routes
router.use(verifyToken);

// ✅ Routes
router.get('/', getAllProducts);                                // ✅ GET all products
router.get('/dropdowns/:id', getProductDropdowns);       // ✅ GET dropdowns with productId (Edit mode)
router.get('/dropdowns', getProductDropdowns);                  // ✅ GET dropdowns only (Create mode)
router.get('/:id/prices', getProductPrices);                    // ✅ GET prices for product by ID
router.get('/:id', getProductById);                             // ✅ GET product by ID
router.post('/', createProduct);                                // ✅ CREATE product
router.put('/:id', updateProduct);                              // ✅ UPDATE product
router.delete('/:id', deleteProduct);                           // ✅ DELETE product
router.delete('/:id/image', deleteProductImage);                // ✅ DELETE image of product
router.post('/:id/prices', addProductPrice);                    // ✅ ADD product price
router.put('/:productId/prices/:priceId', updateProductPrice); // ✅ UPDATE product price
router.delete('/:productId/prices/:priceId', deleteProductPrice); // ✅ DELETE product price

module.exports = router;
