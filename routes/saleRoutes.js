// server/routes/saleRoutes.js

const express = require('express');
const router = express.Router();

const {
  createSale,
  getAllSales,
  getSaleById,
  markSaleAsPaid,
  getAllSalesReturn,
  searchPrintableSales,
  updateSaleDocumentLinesController,
} = require('../controllers/saleController');
const { completeSaleController } = require('../src/modules/sales/controllers/completeSale.controller');

const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

// ✅ POST /api/sales
router.post('/complete', completeSaleController);
router.post('/', createSale);

// ✅ GET /api/sales
router.get('/', getAllSales);

// ✅ GET /api/sales-return
router.get('/return', getAllSalesReturn);

// ✅ GET /api/sales/printable (Sales history for printing)
router.get('/printable', searchPrintableSales);

// 🧭 Backward-compat alias (keep temporarily; safe to remove later)
router.get('/printable-sales', searchPrintableSales);

// ✅ PUT /api/sales/:id/document-lines
router.put('/:id/document-lines', updateSaleDocumentLinesController);

// 🧭 Backward-compat alias (temporary)
router.put('/:id/document-descriptions', updateSaleDocumentLinesController);

// ✅ GET /api/sales/:id
router.get('/:id', getSaleById);

router.post('/:id/mark-paid', markSaleAsPaid);

// 🚫 ห้ามใช้ /return สำหรับ mark-paid (กันยิงผิด intent ใน production)
// หมายเหตุ: ถ้าจะทำ flow คืนสินค้า ให้สร้าง controller/route แยก เช่น POST /return (returnSale)

module.exports = router;
