

// ✅ routes/productTemplateRoutes.js (secured with admin guard, archive/restore)
const express = require('express');
const router = express.Router();

const {
  getAllProductTemplates,
  getProductTemplateById,
  createProductTemplate,
  updateProductTemplate,
  // deleteProductTemplate, // ❌ เลิกใช้ hard delete
  archiveProductTemplate,
  restoreProductTemplate,
} = require('../controllers/productTemplateController');

const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// 🔎 อ่านข้อมูล (ผู้ใช้ที่ล็อกอินเห็นได้)
router.get('/', getAllProductTemplates);           // GET /api/product-templates           // GET /api/product-templates
router.get('/:id', getProductTemplateById);        // GET /api/product-templates/:id

// 🔐 เขียน/แก้ไข (Admin เท่านั้น)
router.post('/', requireAdmin, createProductTemplate);                 // POST /api/product-templates
router.patch('/:id', requireAdmin, updateProductTemplate);             // PATCH /api/product-templates/:id
router.patch('/:id/archive', requireAdmin, archiveProductTemplate);    // PATCH /api/product-templates/:id/archive
router.patch('/:id/restore', requireAdmin, restoreProductTemplate);    // PATCH /api/product-templates/:id/restore

module.exports = router;
