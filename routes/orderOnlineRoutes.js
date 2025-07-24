// orderOnlineRoutes.js

const express = require("express");
const router = express.Router();

const {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineByIdForEmployee,
  getOrderOnlineByIdForCustomer,
  updateOrderOnlineStatus,
  deleteOrderOnline,
  getOrderOnlineByCustomer,
  approveOrderOnlineSlip,
  rejectOrderOnlineSlip,
  submitOrderOnlinePaymentSlip,
  getOrderOnlineByBranch,
} = require("../controllers/orderOnlineController");

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// 🧾 ฝั่งลูกค้า
router.get("/my", getOrderOnlineByCustomer);
router.get("/customer/:id", getOrderOnlineByIdForCustomer);
router.post("/", createOrderOnline);
router.post("/:orderId/payment-slip", submitOrderOnlinePaymentSlip); // ✅ แก้ไข path ให้ถูกต้อง

// 🧾 ฝั่ง POS / พนักงาน
router.get("/branch", getOrderOnlineByBranch); // ✅ รายการคำสั่งซื้อของสาขาปัจจุบัน
router.get("/:id", getOrderOnlineByIdForEmployee); // ✅ ดูรายการแบบเจาะจง
router.patch("/:id/status", updateOrderOnlineStatus); // ✅ อัปเดตสถานะคำสั่งซื้อ POS
router.post("/:id/approve-slip", approveOrderOnlineSlip);
router.post("/:id/reject-slip", rejectOrderOnlineSlip);
router.delete("/:id", deleteOrderOnline);

// ❗ fallback สำหรับ admin หรือ usage พิเศษ
router.get("/", getAllOrderOnline);

module.exports = router;

