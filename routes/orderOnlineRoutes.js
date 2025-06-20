const express = require("express");
const router = express.Router();
const {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineById,
  updateOrderOnlineStatus,
  deleteOrderOnline,
} = require("../controllers/orderOnlineController");

const { verifyToken } = require('../middlewares/verifyToken');

// ✅ ไม่ต้อง verifyToken สำหรับการดูคำสั่งซื้อ (Public)
router.get("/", getAllOrderOnline);
router.get("/:id", getOrderOnlineById);

// ✅ ต้อง login เท่านั้น
router.post("/", verifyToken, createOrderOnline);
router.patch("/:id", verifyToken, updateOrderOnlineStatus);
router.delete("/:id", verifyToken, deleteOrderOnline);

module.exports = router;
