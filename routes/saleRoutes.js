//server/routes/saleRoutes.js

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

// ✅ GET /api/sales-return
router.get("/return", getAllSalesReturn);

router.get('/printable-sales', searchPrintableSales);

// ✅ GET /api/sales/:id
router.get("/:id", getSaleById);


router.post("/:id/mark-paid", markSaleAsPaid);

// 🚫 ห้ามใช้ /return สำหรับ mark-paid (กันยิงผิด intent ใน production)
// หมายเหตุ: ถ้าจะทำ flow คืนสินค้า ให้สร้าง controller/route แยก เช่น POST /return (returnSale)


module.exports = router;




