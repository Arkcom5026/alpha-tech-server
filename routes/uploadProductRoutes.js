// ✅ server/routes/uploadProductRoutes.js
const express = require('express');
const router = express.Router();

const { uploadProductImagesOnly, uploadAndSaveProductImages } = require('../controllers/upload/uploadProductController');
const { deleteProductImage } = require('../controllers/productController');
const uploadProductMiddleware = require('../middlewares/uploadProductMiddleware');

// อัปโหลดเฉพาะไฟล์ (เก็บไว้ชั่วคราว)
router.post('/product-images/upload', uploadProductMiddleware.array('files'), uploadProductImagesOnly);

// อัปโหลดและบันทึกภาพลง DB พร้อมกัน (เฉพาะโหมด Edit เท่านั้น)
router.post('/products/:id/images/upload-full', uploadProductMiddleware.array('files'), uploadAndSaveProductImages);

// ลบภาพ (ระบุ public_id)
router.delete('/products/:id/images/delete', deleteProductImage);

module.exports = router;



