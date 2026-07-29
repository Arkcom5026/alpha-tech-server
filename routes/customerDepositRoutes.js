

// customerDepositRoutes.js (อัปเดตตามแนวทางใหม่ - ใช้เฉพาะ endpoint ที่จำเป็น)

const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
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
} = require('../controllers/customerDepositController');

router.use(verifyToken);

// ✅ Create
router.post('/', createCustomerDeposit);

// ✅ Read All
router.get('/', getAllCustomerDeposits);

// ✅ ดึงรายการลูกค้าตามชื่อ/ชื่อหน่วยงาน เพื่อให้ผู้ใช้เลือกก่อน
router.get('/by-name', getCustomerAndDepositByName);

// ✅ ดึงข้อมูลลูกค้า 1 รายการ + ยอดเงินมัดจำ หลังผู้ใช้เลือกจากผลค้นหา
router.get('/by-customer/:customerId', getCustomerAndDepositByCustomerId);

// ✅ ดึงข้อมูลลูกค้า + ยอดเงินมัดจำ (ใช้ใน DepositPage)
router.get('/by-phone/:phone', getCustomerAndDepositByPhone);

// ✅ Read One
router.get('/:id', getCustomerDepositById);

// ✅ Update
router.put('/:id', updateCustomerDeposit);

// ✅ Delete
router.delete('/:id', deleteCustomerDeposit);

// ✅ ใช้ยอดเงินมัดจำในการขาย
router.post('/use', useCustomerDeposit);

module.exports = router;



