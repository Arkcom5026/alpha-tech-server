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
// Import migration endpoint
const { migrateSnToSimple } = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Public routes (ไม่ต้อง login)
router.get("/online/search", getProductsForOnline); 
router.get('/online/dropdowns', getProductDropdownsForOnline);
router.get("/online/detail/:id", getProductOnlineById);
router.get('/dropdowns', getProductDropdowns); // ✅ เปลี่ยนให้เป็น public

// ✅ Protected routes (ต้อง login)
router.use(verifyToken);

router.get('/', getAllProducts);
router.get('/lookup', getProductsForPos); 
router.get('/pos/search', getProductsForPos); 
router.get('/:id', getProductPosById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id', updateProduct); // alias for PATCH
router.post('/:id/migrate-to-simple', migrateSnToSimple); // SN→SIMPLE migration
router.post('/pos/migrate-to-simple/:id', migrateSnToSimple); // POS-style alias
router.delete('/:id', deleteProduct);
router.delete('/:id/image', deleteProductImage);


module.exports = router;




