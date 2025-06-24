// ✅ server/routes/uploadProductRoutes.js
const express = require('express');
const router = express.Router();

const { uploadProductImagesOnly, uploadAndSaveProductImages } = require('../controllers/upload/uploadProductController');
const { deleteProductImage } = require('../controllers/productController');
const uploadProductMiddleware = require('../middlewares/uploadProductMiddleware');

// อัปโหลดเฉพาะไฟล์ (เก็บไว้ชั่วคราว)
router.post('/images/upload', uploadProductMiddleware.array('images'), uploadProductImagesOnly);

//router.post('/images/upload-temp', uploadProductTemplateMiddleware.array('images'), uploadProductTemplateImagesOnly);


// ✅ เปลี่ยนเป็น single('files') สำหรับโหมด Edit
router.post('/:id/images/upload-full', uploadProductMiddleware.single('files'), uploadAndSaveProductImages);

// ลบภาพ (ระบุ public_id)
router.post('/:id/images/delete', deleteProductImage);


module.exports = router;
