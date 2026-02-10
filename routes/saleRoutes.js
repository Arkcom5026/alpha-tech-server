const express = require("express");
const router = express.Router();

const { createSale,
    getAllSales,
    getSaleById,
    markSaleAsPaid,
    getAllSalesReturn,
    searchPrintableSales
} = require("../controllers/saleController");


const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ POST /api/sales
router.post("/", createSale);

// ✅ GET /api/sales
router.get("/", getAllSales);

// ✅ GET /api/sales-ruturn
router.get("/return", getAllSalesReturn);

router.get('/printable-sales', searchPrintableSales);

// ✅ GET /api/sales/:id
router.get("/:id", getSaleById);


router.post("/:id/mark-paid", markSaleAsPaid);

router.post("/return", markSaleAsPaid);


module.exports = router;
