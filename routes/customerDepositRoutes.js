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
  useCustomerDeposit,
} = require('../controllers/customerDepositController');

router.use(verifyToken);

// ✅ Create
router.post('/', createCustomerDeposit);

// ✅ Read All
router.get('/', getAllCustomerDeposits);

// ✅ ดึงข้อมูลลูกค้า + ยอดเงินมัดจำ ด้วยชื่อ
router.get('/by-name', getCustomerAndDepositByName);


// ✅ Read One
router.get('/:id', getCustomerDepositById);

// ✅ Update
router.put('/:id', updateCustomerDeposit);

// ✅ Delete
router.delete('/:id', deleteCustomerDeposit);

// ✅ ดึงข้อมูลลูกค้า + ยอดเงินมัดจำ (ใช้ใน DepositPage)
router.get('/by-phone/:phone', getCustomerAndDepositByPhone);



// ✅ ใช้ยอดเงินมัดจำในการขาย
router.post('/use', useCustomerDeposit);

module.exports = router;
