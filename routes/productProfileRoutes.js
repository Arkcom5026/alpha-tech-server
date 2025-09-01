
// ✅ backend/routes/productProfileRoutes.js (secured with admin guard, archive/restore)
const express = require('express');
const router = express.Router();

const {
  createProductProfile,
  getAllProductProfiles,
  getProfilesByCategory,
  getProductProfileById,
  updateProductProfile,
  // deleteProductProfile, // ❌ เลิกใช้ hard delete
  archiveProductProfile,
  restoreProductProfile,
  getProductProfileDropdowns,
} = require('../controllers/productProfileController');

const { verifyToken } = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// ⚠️ วางเส้นทางเฉพาะเจาะจงก่อน `/:id` เสมอ
router.get('/category/:categoryId', getProfilesByCategory); // GET /api/product-profiles/category/:categoryId
router.get('/dropdowns', getProductProfileDropdowns);       // GET /api/product-profiles/dropdowns (active only)

// 🔎 อ่านข้อมูล (ผู้ใช้ที่ล็อกอินทุกคน)
router.get('/', getAllProductProfiles);            // GET /api/product-profiles
router.get('/:id', getProductProfileById);         // GET /api/product-profiles/:id

// 🔐 เขียน/แก้ไข (Admin เท่านั้น)
router.post('/', requireAdmin, createProductProfile);                 // POST /api/product-profiles
router.patch('/:id', requireAdmin, updateProductProfile);             // PATCH /api/product-profiles/:id
router.patch('/:id/archive', requireAdmin, archiveProductProfile);    // PATCH /api/product-profiles/:id/archive
router.patch('/:id/restore', requireAdmin, restoreProductProfile);    // PATCH /api/product-profiles/:id/restore

module.exports = router;

// 📌 วิธีผูกใน server หลัก (ตัวอย่าง)
// const productProfileRoutes = require('./routes/productProfileRoutes');
// app.use('/api/product-profiles', productProfileRoutes);


