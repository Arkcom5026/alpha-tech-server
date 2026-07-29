const express = require('express');

const verifyToken = require('../../../../../middlewares/verifyToken');
const {
  createCustomerDeposit,
  getAllCustomerDeposits,
  getCustomerDepositById,
  updateCustomerDeposit,
  deleteCustomerDeposit,
  getCustomerAndDepositByPhone,
  getCustomerAndDepositByName,
  getCustomerAndDepositByCustomerId,
  useCustomerDeposit,
} = require('../../../../../controllers/customerDepositController');

const router = express.Router();
router.use(verifyToken);

router.post('/', createCustomerDeposit);
router.get('/', getAllCustomerDeposits);
router.get('/by-name', getCustomerAndDepositByName);
router.get('/by-customer/:customerId', getCustomerAndDepositByCustomerId);
router.get('/by-phone/:phone', getCustomerAndDepositByPhone);
router.get('/:id', getCustomerDepositById);
router.put('/:id', updateCustomerDeposit);
router.delete('/:id', deleteCustomerDeposit);
router.post('/use', useCustomerDeposit);

module.exports = router;
