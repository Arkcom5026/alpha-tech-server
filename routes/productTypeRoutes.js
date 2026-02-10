// ✅ routes/productTypeRoutes.js (secured with admin guard, archive/restore instead of hard delete)
const express = require('express');
const router = express.Router();

const {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  // deleteProductType, // ❌ ไม่ใช้แล้ว (เปลี่ยนเป็น archive/restore)
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
} = require('../controllers/productTypeController');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// ⚠️ วาง route เฉพาะเจาะจงก่อน `/:id` เสมอ
router.get('/dropdowns', getProductTypeDropdowns); // GET /api/product-types/dropdowns

// 🔎 อ่านข้อมูล (ให้ผู้ใช้ที่ล็อกอินเห็นได้ตามปกติ)
router.get('/', getAllProductType);               // GET /api/product-types
router.get('/:id', getProductTypeById);           // GET /api/product-types/:id

// 🔐 จัดการข้อมูล (Admin เท่านั้น)
router.post('/', requireAdmin, createProductType);                // POST /api/product-types
router.patch('/:id', requireAdmin, updateProductType);            // PATCH /api/product-types/:id
router.patch('/:id/archive', requireAdmin, archiveProductType);   // PATCH /api/product-types/:id/archive
router.patch('/:id/restore', requireAdmin, restoreProductType);   // PATCH /api/product-types/:id/restore

module.exports = router;
