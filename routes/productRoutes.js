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
  searchProducts,
  getProductsForOnline,
  getProductOnlineById,
  getProductDropdownsForOnline,
  getProductsForPos, // ✅ เพิ่มใหม่
} = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Public routes (ไม่ต้อง login)
router.get("/online/search", getProductsForOnline); 
router.get('/online/dropdowns', getProductDropdownsForOnline);
router.get("/online/detail/:id", getProductOnlineById);


// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

router.get('/', getAllProducts);
router.get('/dropdowns/:id', getProductDropdowns);
router.get('/dropdowns', getProductDropdowns);
router.get('/search', searchProducts);
router.get('/pos/search', getProductsForPos); 
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.delete('/:id/image', deleteProductImage);

module.exports = router;
   
