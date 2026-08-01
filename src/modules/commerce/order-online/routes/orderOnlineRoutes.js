// orderOnlineRoutes.js

const express = require('express');
const router = express.Router();

const {
  createOrderOnline,
  getAllOrderOnline,
  getOrderOnlineByIdForEmployee,
  getOrderOnlineByIdForCustomer,
  updateOrderOnlineStatus,
  deleteOrderOnline,
  getOrderOnlineByCustomer,
  approveOrderOnlineSlip,
  rejectOrderOnlineSlip,
  submitOrderOnlinePaymentSlip,
  getOrderOnlineByBranch,
  getOrderOnlineSummary,
} = require('../runtime/orderOnlineRuntimeController');

const verifyToken = require('../../../../../middlewares/verifyToken');
router.use(verifyToken);

router.get('/my', getOrderOnlineByCustomer);
router.get('/customer/:id', getOrderOnlineByIdForCustomer);
router.post('/', createOrderOnline);
router.post('/:orderId/payment-slip', submitOrderOnlinePaymentSlip);
router.get('/branch', getOrderOnlineByBranch);
router.get('/:id', getOrderOnlineByIdForEmployee);
router.get('/:id/summary', getOrderOnlineSummary);
router.patch('/:id/status', updateOrderOnlineStatus);
router.post('/:id/approve-slip', approveOrderOnlineSlip);
router.post('/:id/reject-slip', rejectOrderOnlineSlip);
router.delete('/:id', deleteOrderOnline);
router.get('/', getAllOrderOnline);

module.exports = router;
