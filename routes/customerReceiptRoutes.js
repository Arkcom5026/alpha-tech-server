

// routes/customerReceiptRoutes.js

const express = require('express');
const router = express.Router();

const {
  createCustomerReceipt,
  getCustomerReceiptById,
  allocateCustomerReceipt,
  cancelCustomerReceipt,
  searchCustomerReceipts,
  searchCustomersForReceipt,
  searchAllocationCandidates,
} = require('../controllers/customerReceiptController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// ============================================================
// customerReceiptRoutes.js
// P1 / Customer Receipt Routes
// ------------------------------------------------------------
// Base path:
// /api/customer-receipts
// ============================================================

router.get('/', searchCustomerReceipts);
router.get('/customer-search', searchCustomersForReceipt);
router.post('/', createCustomerReceipt);
router.get('/:id', getCustomerReceiptById);
router.get('/:id/allocation-candidates', searchAllocationCandidates);
router.post('/:id/allocate', allocateCustomerReceipt);
router.post('/:id/cancel', cancelCustomerReceipt);

module.exports = router;

