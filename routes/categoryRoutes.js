// ✅ routes/categoryRoutes.js (secured with admin guard, archive/restore)
const express = require('express');
const router = express.Router();

const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  // deleteCategory, // ❌ เลิกใช้ hard delete
  archiveCategory,
  restoreCategory,
  getCategoryDropdowns,
} = require('../controllers/categoryController');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// ⚠️ สำคัญ: ต้องวาง route แบบเฉพาะเจาะจงก่อน `/:id` เสมอ เพื่อกันชนกัน
router.get('/dropdowns', getCategoryDropdowns); // GET /api/categories/dropdowns

// 🔎 อ่านข้อมูล (ให้ผู้ใช้ที่ล็อกอินเห็นได้ตามปกติ)
router.get('/', getAllCategories);              // GET /api/categories
router.get('/:id', getCategoryById);            // GET /api/categories/:id

// 🔐 จัดการข้อมูล (Admin เท่านั้น)
router.post('/', requireAdmin, createCategory);             // POST /api/categories { name }
router.put('/:id', requireAdmin, updateCategory);           // PUT /api/categories/:id { name }
router.patch('/:id/archive', requireAdmin, archiveCategory); // PATCH /api/categories/:id/archive
router.patch('/:id/restore', requireAdmin, restoreCategory); // PATCH /api/categories/:id/restore

module.exports = router;
