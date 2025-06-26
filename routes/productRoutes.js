// ✅ server/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductPosById,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,  
  getProductsForOnline,
  getProductOnlineById,
  getProductDropdownsForOnline,
  getProductsForPos, // ✅ สำหรับ POS
} = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Public routes (ไม่ต้อง login)
router.get("/online/search", getProductsForOnline); 
router.get('/online/dropdowns', getProductDropdownsForOnline);
router.get("/online/detail/:id", getProductOnlineById);
router.get('/dropdowns', getProductDropdowns); // ✅ เปลี่ยนให้เป็น public

// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

router.get('/', getAllProducts);
router.get('/pos/search', getProductsForPos); 
router.get('/:id', getProductPosById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.delete('/:id/image', deleteProductImage);

module.exports = router;
