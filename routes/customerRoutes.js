// customerRoutes.js

const express = require('express');
const router = express.Router();
const {
  getCustomerByPhone,
  getCustomerByName,
  getCustomerByUserId,
  createCustomer,
  updateCustomerProfile,
  updateCustomerProfileOnline,
} = require('../controllers/customerController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', getCustomerByPhone);
router.get('/by-name', getCustomerByName);
router.get('/me', getCustomerByUserId);
router.get('/me-pos', getCustomerByUserId);      // ✅ เพิ่ม route POS
router.get('/me-online', getCustomerByUserId);   // ✅ เพิ่ม route Online
router.post('/', createCustomer);
router.patch('/me-pos', updateCustomerProfile);
router.patch('/me-online', updateCustomerProfileOnline);

module.exports = router;
