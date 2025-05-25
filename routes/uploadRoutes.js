// ✅ routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { uploadImage } = require('../controllers/uploadController');

// เพิ่ม try/catch รอบ multer().array() เพื่อ handle error เช่น ขนาดเกิน, mimetype ผิด ฯลฯ
router.post('/', (req, res, next) => {
  upload.array('images')(req, res, function (err) {
    if (err) {
      console.error('❌ Multer Upload Error:', err.message);
      return res.status(400).json({ error: 'Upload failed', details: err.message });
    }
    next();
  });
}, uploadImage);

module.exports = router;