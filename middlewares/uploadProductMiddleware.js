// ✅ middlewares/uploadProductMiddleware.js (Refactored ให้ใช้ memoryStorage + stream)
const multer = require('multer');

// ใช้ memoryStorage แทน CloudinaryStorage
const storage = multer.memoryStorage();

const uploadProductMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัดขนาด 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

module.exports = uploadProductMiddleware;

// ปิดท้าย uploadProductMiddleware.js
