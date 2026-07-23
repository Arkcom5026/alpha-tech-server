const express = require('express');
const {
  getSaleReturnEligibilityController,
  completeSaleReturnController,
} = require('../controllers/saleReturnController');

const router = express.Router();
router.get('/eligible/:saleId', getSaleReturnEligibilityController);
router.post('/complete', completeSaleReturnController);

module.exports = router;
