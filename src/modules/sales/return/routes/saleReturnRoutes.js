const express = require('express');
const {
  getSaleReturnEligibilityController,
  completeSaleReturnController,
} = require('../controllers/saleReturnController');
const {
  getAllSaleReturns,
} = require('../query/list/getAllSaleReturnsController');
const {
  getSaleReturnById,
} = require('../query/detail/getSaleReturnByIdController');
const { requireSaleReturnAccess } = require('../shared/saleReturnAuthorization');

const router = express.Router();
router.use(requireSaleReturnAccess);

router.get('/eligible/:saleId', getSaleReturnEligibilityController);
router.post('/complete', completeSaleReturnController);

// Compatibility path retained for the existing POS return screen.
router.post('/create', completeSaleReturnController);
router.get('/', getAllSaleReturns);
router.get('/:id', getSaleReturnById);

module.exports = router;
