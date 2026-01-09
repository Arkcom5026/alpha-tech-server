

// ✅ server/routes/productRoutes.js (อัปเดต)
const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductPosById,
  createProduct,
  updateProduct,  deleteProduct, // (legacy alias)
  disableProduct,
  enableProduct,
  getProductDropdowns,
  getProductsForOnline,
  getProductOnlineById,
  getProductsForPos, // ✅ สำหรับ POS
  migrateSnToSimple, // ✅ SN→SIMPLE migration
} = require('../controllers/productController');
const { verifyToken } = require('../middlewares/verifyToken');

// ✅ Public routes (ไม่ต้อง login)
router.get("/online/search", getProductsForOnline); 
router.get('/online/dropdowns', getProductDropdowns); // ✅ ใช้ getProductDropdowns เดียว
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
// ✅ Product Active (แทนการลบจริง)
router.post('/:id/disable', disableProduct);
router.post('/:id/enable', enableProduct);
router.delete('/:id', disableProduct); // legacy alias (soft-disable)


// ✅ Image upload/delete routes (Cloudinary + DB)
//    Mounted under /api/products via this productRoutes
const uploadProductRoutes = require('./uploadProductRoutes');
router.use('/', uploadProductRoutes);

module.exports = router;



