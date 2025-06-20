// 📦 branchPriceRoutes.js

const express = require("express");
const router = express.Router();

const {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
} = require("../controllers/branchPriceController");

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ ดึงราคาที่ใช้งาน ณ เวลาปัจจุบัน สำหรับสินค้าหนึ่งในสาขาหนึ่ง
router.get("/me/:productId", getActiveBranchPrice);

// ✅ สร้างหรือแก้ไขราคาของสาขา (รองรับโปรโมชั่น)
router.post("/", upsertBranchPrice);

// ✅ ดึงราคาทั้งหมดของสาขานั้น (เช่น ใช้ในหน้า list)
router.get("/by-branch", getBranchPricesByBranch);

// ✅ ดึงสินค้าทั้งหมด พร้อมราคาแยกตามสาขา (ใช้ในหน้าแก้ไขราคา)
router.get("/all-products", getAllProductsWithBranchPrice);

module.exports = router;
