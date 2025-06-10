const express = require("express");
const router = express.Router();
const { createSaleReturn, getAllSaleReturns, getSaleReturnById } = require("../controllers/saleReturnController");

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ POST /api/sale-returns/create
router.post('/create', createSaleReturn); 
router.get('/',  getAllSaleReturns);
router.get('/:id', getSaleReturnById);

module.exports = router;
