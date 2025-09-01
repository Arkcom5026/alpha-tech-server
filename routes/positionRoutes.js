// ✅ backend/routes/positionRoutes.js (aligned with productProfileRoutes style)
const express = require('express');
const router = express.Router();

const {
  listPositions,
  getDropdowns,
  getById,
  createPosition,
  updatePosition,
  toggleActive,
  hardDelete,
} = require('../controllers/positionController');

const { verifyToken } = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// 🔽 วางเส้นทางเฉพาะเจาะจงก่อนตัวแปร `/:id`
router.get('/dropdowns', getDropdowns); // GET /api/positions/dropdowns (active only)

// 🔎 อ่านข้อมูล (ผู้ใช้ที่ล็อกอินทุกคน)
router.get('/', listPositions);      // GET /api/positions
router.get('/:id', getById);         // GET /api/positions/:id

// 🔐 เขียน/แก้ไข (Admin เท่านั้น)
router.post('/', requireAdmin, createPosition);                 // POST /api/positions
router.patch('/:id', requireAdmin, updatePosition);             // PATCH /api/positions/:id
router.patch('/:id/toggle-active', requireAdmin, toggleActive); // PATCH /api/positions/:id/toggle-active

// ⚠️ Hard delete (ควรปิดในโปรดักชัน)
router.delete('/:id', requireAdmin, hardDelete);

module.exports = router;

// 📌 วิธีผูกใน server หลัก (ตัวอย่าง)
// const positionRoutes = require('./routes/positionRoutes');
// app.use('/api/positions', positionRoutes);
