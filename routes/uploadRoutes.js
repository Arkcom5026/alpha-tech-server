// ✅ routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');

const uploadProduct = require('../middlewares/uploadProductMiddleware');
const uploadProductTemplate = require('../middlewares/uploadProductTemplateMiddleware');


// // เพิ่ม try/catch รอบ multer().array() เพื่อ handle error เช่น ขนาดเกิน, mimetype ผิด ฯลฯ
// router.post('/', (req, res, next) => {
//   upload.array('images')(req, res, function (err) {
//     if (err) {
//       console.error('❌ Multer Upload Error:', err.message);
//       return res.status(400).json({ error: 'Upload failed', details: err.message });
//     }
//     next();
//   });
// }, uploadImage);



router.post('/product-images', (req, res, next) => {
  uploadProduct.array('images')(req, res, function (err) {
    if (err) {
      console.error('❌ Multer Upload Error (product):', err.message);
      return res.status(400).json({ error: 'Upload failed', details: err.message });
    }
    next();
  });
}, uploadImage);


router.post('/templates-images', (req, res, next) => {
  uploadProductTemplate.array('images')(req, res, function (err) {
    if (err) {
      console.error('❌ Multer Upload Error (template):', err.message);
      return res.status(400).json({ error: 'Upload failed', details: err.message });
    }
    next();
  });
}, uploadImage);


module.exports = router;




