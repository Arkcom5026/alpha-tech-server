
const express = require("express");
const router = express.Router();
const {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineById,
  deleteOrderOnline,
} = require("../controllers/orderOnlineController");

const { verifyToken } = require('../middlewares/verifyToken');

// ✅ ไม่ต้อง verifyToken สำหรับการดูสินค้า (Public)

router.get("/online", getAllOrderOnline);
router.get("/online/:id", getOrderOnlineById);
            

// ✅ ต้อง login เท่านั้น
router.post("/online", verifyToken, createOrderOnline);
router.delete("/online/:id", verifyToken, deleteOrderOnline);

module.exports = router;


