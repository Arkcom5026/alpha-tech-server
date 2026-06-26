// src/routes/branchPriceRoutes.js

const express = require("express");
const router = express.Router();

// 1. ดึงกลุ่มจัดการราคาสินค้ามาตามปกติ (เอา getBranchBySlug ออกจากกลุ่มนี้)
const {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
} = require("../controllers/branchPriceController");

// 🟢 2. ดึงฟังก์ชันข้ามสายมาจากห้องเครื่องสาขาตัวจริง!
const { getBranchBySlug } = require("../controllers/branchController"); 

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get("/me/:productId", getActiveBranchPrice);
router.post("/", upsertBranchPrice);
router.get("/by-branch", getBranchPricesByBranch);
router.get("/all-products", getAllProductsWithBranchPrice);
router.put("/bulk-update", updateMultipleBranchPrices);

// 🚀 ท่อทำงานได้ใสสะอาด ไร้ตัวตนลึกลับ undefined แน่นอน!
router.get('/profile-by-slug/:slug', getBranchBySlug);

module.exports = router;