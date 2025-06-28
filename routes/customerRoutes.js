// customerRoutes.js

const express = require('express');
const router = express.Router();
const {
  getCustomerByPhone,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
  getCustomerByName,
} = require('../controllers/customerController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', getCustomerByPhone);
router.get('/by-name', getCustomerByName);
router.get('/me', getCustomerByUserId);
router.post('/', createCustomer);
router.patch('/me', updateCustomerProfile);

router.put('/profile', updateCustomerProfile);

module.exports = router;
