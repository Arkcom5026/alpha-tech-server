// ✅ middlewares/uploadProductTemplateMiddleware.js
const multer = require('multer');

// ใช้ memoryStorage สำหรับอัปโหลดภาพไป Cloudinary
const storage = multer.memoryStorage();

const uploadProductTemplateMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัดขนาดไม่เกิน 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์ภาพเท่านั้น'), false);
    }
  },
});

module.exports = uploadProductTemplateMiddleware;


