// ✅ routes/authRoutes.js (CommonJS)
const express = require('express');
const router = express.Router();

const { login,register } = require('../controllers/authController');
const { verifyToken } = require('../middleware/verifyToken');
const { protectRole } = require('../middleware/protectRole');
const { validateRegister } = require('../middleware/validateRegister');

// 🔐 Login route
router.post('/login', login);
// ✅ สมัครสมาชิก (Register)
router.post('/register', validateRegister, register);

// 🧪 ตัวอย่างการใช้ verifyToken + protectRole
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user, branchId: req.branchId });
});

router.get('/admin-only', verifyToken, protectRole('admin'), (req, res) => {
  res.json({ message: 'เฉพาะแอดมินเข้าถึงได้' });
});

router.get('/employee-or-admin', verifyToken, protectRole('admin', 'employee'), (req, res) => {
  res.json({ message: 'พนักงานหรือแอดมินเข้าถึงได้' });
});

module.exports = router;
