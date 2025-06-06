const express = require("express");
const router = express.Router();

const { createSale, getAllSales, getSaleById } = require("../controllers/saleController");


const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ POST /api/sales
router.post("/", createSale);

// ✅ GET /api/sales
router.get("/", getAllSales);

// ✅ GET /api/sales/:id
router.get("/:id", getSaleById);

module.exports = router;
