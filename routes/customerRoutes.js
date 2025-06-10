const express = require('express');
const router = express.Router();
const {
  getCustomerByPhone,
  createCustomer,
  updateCustomer, // ✅ เพิ่ม controller ใหม่
} = require('../controllers/customerController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/by-phone/:phone', getCustomerByPhone);
router.post('/', createCustomer);
router.put('/:id', updateCustomer); // ✅ เพิ่ม route สำหรับอัปเดตลูกค้า

module.exports = router;
