const express = require('express');

const verifyToken = require('../../../../../middlewares/verifyToken');
const { getCombinableSales } = require('../query/combinable-sales/getCombinableSalesController');
const {
  createCombinedBillingDocument,
  getCombinedBillingById,
  getCustomersWithPendingSales,
} = require('../../../../../controllers/combinedBillingController');

const router = express.Router();
router.use(verifyToken);

router.get('/combinable-sales', getCombinableSales);
router.post('/create', createCombinedBillingDocument);
router.get('/combined-billing/:id', getCombinedBillingById);
router.get('/with-pending-sales', getCustomersWithPendingSales);

module.exports = router;
