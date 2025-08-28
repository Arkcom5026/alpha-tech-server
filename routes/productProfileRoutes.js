// ✅ backend/routes/productProfileRoutes.js (มาตรฐานเดียวกับระบบ)
const express = require('express');
const router = express.Router();
const {
  createProductProfile,
  getAllProductProfiles,
  getProfilesByCategory,
  getProductProfileById,
  updateProductProfile,
  deleteProductProfile,
} = require('../controllers/productProfileController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// CRUD + filters (ทั้งหมดต้องผ่าน auth)
router.get('/',  getAllProductProfiles);
router.get('/category/:categoryId',  getProfilesByCategory);
router.get('/:id',  getProductProfileById);
router.post('/',  createProductProfile);
router.patch('/:id',  updateProductProfile);
router.delete('/:id',  deleteProductProfile);

module.exports = router;

// 📌 วิธีผูกใน server หลัก (ตัวอย่าง)
// const productProfileRoutes = require('./routes/productProfileRoutes');
// app.use('/api/product-profiles', productProfileRoutes);
