// routes/authRoutes.js 
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

// ✅ ปรับกลไกมาดักเช็กและดึงฟังก์ชันแบบ Dynamic Runtime (Lazy Handler) ป้องกันปัญหา Circular Dependency
const run = (key) => (req, res, next) => {
  const fn = authController?.[key];
  if (typeof fn === 'function') {
    return fn(req, res, next);
  }
  
  // ตรวจสอบโครงสร้าง alias อื่น ๆ ตามสถาปัตยกรรมเดิมของคุณ
  if (fn && typeof fn.handler === 'function') return fn.handler(req, res, next);
  if (fn && typeof fn.handle === 'function') return fn.handle(req, res, next);
  if (fn && typeof fn.fn === 'function') return fn.fn(req, res, next);

  return res.status(500).json({ 
    error: `[Runtime Error] authController.${key} is not a valid handler function.` 
  });
};

// ✅ verifyToken: single export (CommonJS)
const verifyToken = require('../middlewares/verifyToken');

// 🔐 Login / Register / Session (สับสายผ่านตัววิ่ง run() แบบข้ามเลนวนลูป)
router.post('/login', run('login'));
router.post('/register', run('register'));

// Remember Me / session persistence hooks
router.post('/refresh', run('refreshSession'));
router.post('/logout', run('logoutSession'));

// 👥 [SUB-EMPLOYEE CREATION LINK]: เจาะช่องเปิดท่อรับคำสั่งเพิ่มพนักงานย่อยฝั่งสาขา
router.post('/add-sub-employee', verifyToken, run('addSubEmployee'));

// 🔐 Logout All Sessions
router.post('/logout-all', verifyToken, (req, res, next) => {
  const revokeFn = authController?.revokeSession || authController?.logoutAllSessions || authController?.logoutAll;
  const target = typeof revokeFn === 'function' ? revokeFn : (revokeFn && typeof revokeFn.handler === 'function' ? revokeFn.handler : null);
  if (typeof target === 'function') return target(req, res, next);
  return res.status(500).json({ error: 'Logout all handler not found' });
});

// 🔍 Find user by email (for employee approval)
router.get('/users/find', verifyToken, run('findUserByEmail'));

// ✅ Current session / bootstrap auth
router.get('/me', verifyToken, run('getMe'));

// 🔁 Forgot / Reset Password
router.post('/forgot-password', run('forgotPassword'));
router.post('/reset-password', run('resetPassword'));

module.exports = router;