// ✅ routes/productTypeRoutes.js (อัปเดตให้ครบ CRUD)
const express = require('express');
const router = express.Router();
const {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
  getProductTypeDropdowns,
} = require('../controllers/productTypeController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// dropdown สำหรับ UI เลือกค่าอย่างรวดเร็ว
router.get('/dropdowns', getProductTypeDropdowns);

// CRUD หลัก (ตามมาตรฐานโปรเจกต์)
router.get('/',  getAllProductType);
router.get('/:id',  getProductTypeById);
router.post('/', createProductType);
router.patch('/:id',  updateProductType);
router.delete('/:id', deleteProductType);

module.exports = router;

