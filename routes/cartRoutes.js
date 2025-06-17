// ✅ cartRoutes.js (รองรับ guest โดยไม่ใช้ authenticate middleware global)
const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
} = require('../controllers/cartController');

// ✅ Route ที่ต้อง login จะตรวจสอบภายใน controller แทน
router
  .get('/', getCart)
  .post('/items', addToCart)
  .delete('/items/:productId', removeFromCart)
  .post('/clear', clearCart);

module.exports = router;
