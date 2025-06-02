// uploadProductTemplateRoutes.js
const express = require('express');
const router = express.Router();

const {
  uploadAndSaveProductTemplateImages,
  uploadProductTemplateImagesOnly,
  
} = require('../controllers/upload/uploadProductTemplateController');

const { deleteProductTemplateImage } = require('../controllers/productTemplateController');
const uploadProductTemplateMiddleware = require('../middlewares/uploadProductTemplateMiddleware');



// ✅ [POST] Upload รูปภาพ Product Template (แนบลง DB ทันที)
router.post(
  '/:id/images/upload-full',
  uploadProductTemplateMiddleware.array('images'),
  uploadAndSaveProductTemplateImages
);

// ✅ [POST] Upload รูปภาพ Product Template (เฉพาะอัปโหลด - ยังไม่แนบ DB)
router.post(
  '/images/upload-temp',
  uploadProductTemplateMiddleware.array('images'),
  uploadProductTemplateImagesOnly
);

// ✅ [DELETE] ลบภาพ Product Template ทั้งจาก Cloudinary และ Prisma
router.delete('/:id/images/delete', deleteProductTemplateImage);

module.exports = router;