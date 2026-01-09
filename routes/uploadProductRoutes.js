
// ✅ server/routes/uploadProductRoutes.js
const express = require('express');
const router = express.Router();

const {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  deleteProductImage,
  setProductCoverImage,
} = require('../controllers/upload/uploadProductController');

const uploadProductMiddleware = require('../middlewares/uploadProductMiddleware');

// ✅ อัปโหลดเฉพาะไฟล์ (temp) — FE ส่ง field = 'files'
router.post('/images/upload', uploadProductMiddleware.array('files'), uploadProductImagesOnly);

// ✅ Upload + Save (ผูก product) — FE ส่ง field = 'file' (multer.single)
router.post('/:id/images/upload-full', uploadProductMiddleware.single('file'), uploadAndSaveProductImages);

// ✅ ลบภาพ (รองรับทั้งส่ง imageId/publicId ใน body หรือส่ง imageId ผ่าน params)
router.post('/:id/images/delete', deleteProductImage);
router.delete('/:id/images/delete', deleteProductImage);

// ✅ เผื่อ FE เรียกแบบ /:id/images/:imageId
router.post('/:id/images/:imageId/delete', deleteProductImage);
router.delete('/:id/images/:imageId', deleteProductImage);

// ✅ ตั้งรูปนี้เป็น Cover (ต้องมีแค่ 1 รูปที่เป็น cover ต่อสินค้า)
router.patch('/:id/images/:imageId/cover', setProductCoverImage);

module.exports = router;

