const express = require('express');
const router = express.Router();

const { createSaleOrder } = require('../controllers/saleOrderController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ POST /api/sale-orders → สร้างคำสั่งขายสินค้าใหม่
router.post('/', createSaleOrder);

module.exports = router;
