// routes/cartSyncRoutes.js
const express = require("express");
const router = express.Router();
const {
  syncCartItems,
  removeCartItem,
  updateCartItemQuantity,
} = require("../controllers/cart_sync_controller");

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// 🔐 ต้อง login ก่อนจึงจะ sync cart ได้
router.post("/", syncCartItems);

// ✅ เพิ่มฟังก์ชันจัดการ cart สำหรับ user ที่ login แล้วโดยเฉพาะ
router.delete("/:productId", removeCartItem);
router.patch("/:productId", updateCartItemQuantity);

module.exports = router;
