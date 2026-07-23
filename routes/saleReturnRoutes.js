const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const {
  getAllSaleReturns,
  getSaleReturnById,
} = require('../controllers/saleReturnController');
const {
  completeSaleReturnController,
} = require('../src/modules/sales/return/controllers/saleReturnController');

const router = express.Router();
router.use(verifyToken);

// Compatibility path retained, but mutation authority is canonical.
// Legacy payloads fail validation instead of writing an unsafe RETURNED projection.
router.post('/create', completeSaleReturnController);
router.get('/', getAllSaleReturns);
router.get('/:id', getSaleReturnById);

module.exports = router;
