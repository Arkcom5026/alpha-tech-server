// 📦 branchPriceRoutes.js

const express = require("express");
const router = express.Router();

const {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices, // ✅ เพิ่ม controller สำหรับ bulk update
} = require("../controllers/branchPriceController");

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);


router.get("/me/:productId", getActiveBranchPrice);
router.post("/", upsertBranchPrice);
router.get("/by-branch", getBranchPricesByBranch);
router.get("/all-products", getAllProductsWithBranchPrice);
router.put("/bulk-update", updateMultipleBranchPrices);

module.exports = router;

 
