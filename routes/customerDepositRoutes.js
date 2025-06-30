// customerDepositRoutes.js (อัปเดตตามแนวทางใหม่ - ใช้เฉพาะ endpoint ที่จำเป็น)

const express = require('express');
const router = express.Router();


const { verifyToken } = require('../middlewares/verifyToken');
const { createCustomerDeposit, getAllCustomerDeposits, getCustomerDepositById, updateCustomerDeposit, deleteCustomerDeposit, getCustomerAndDepositByPhone } = require('../controllers/customerDepositController');
router.use(verifyToken);

// ✅ Create
router.post('/', createCustomerDeposit);

// ✅ Read All
router.get('/', getAllCustomerDeposits);

// ✅ Read One
router.get('/:id', getCustomerDepositById);

// ✅ Update
router.put('/:id', updateCustomerDeposit);

// ✅ Delete
router.delete('/:id', deleteCustomerDeposit);

// ✅ ดึงข้อมูลลูกค้า + ยอดเงินมัดจำ (ใช้ใน DepositPage)
router.get('/by-phone/:phone', getCustomerAndDepositByPhone);

module.exports = router;