// ✅ cartRoutes.js (แก้ให้ทุกคำสั่งใน cart ต้อง login ก่อนด้วย verifyToken)
const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  mergeCart,
  updateCartItem,
  getBranchPrices, // ✅ เพิ่มฟังก์ชันใหม่
} = require('../controllers/cartController');
const verifyToken = require('../middlewares/verifyToken');

// ✅ ย้าย verifyToken ขึ้นบนสุด เพื่อให้ทุกคำสั่งผ่าน auth
router.use(verifyToken);

router.post('/items', addToCart);
router.delete('/items/:productId', removeFromCart);

router.post('/clear', clearCart);
router.get('/', getCart);
router.post('/merge', mergeCart);
router.patch('/item/:productId', updateCartItem);

// ✅ route สำหรับดึงราคาขายของแต่ละ branch
router.get('/branch-prices/:branchId', getBranchPrices);

module.exports = router;