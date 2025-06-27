const express = require('express');
const router = express.Router();
const {
  getCustomerByPhone,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
} = require('../controllers/customerController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', getCustomerByPhone);
router.get('/me', getCustomerByUserId);
router.post('/', createCustomer);
router.patch('/me', updateCustomerProfile);

router.put('/profile', updateCustomerProfile);

module.exports = router;