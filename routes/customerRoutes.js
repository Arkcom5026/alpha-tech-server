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

router.post('/', createCustomer);
// ⚠️ เปลี่ยนให้สอดคล้องกับ FE และ controller: ใช้ PUT /customers/me และ PUT /customers/:id
// วาง /me ก่อน /:id เพื่อไม่ให้ชน Route param
router.put('/me', updateCustomerProfileOnline);
router.put('/:id', updateCustomerProfile);


module.exports = router;

