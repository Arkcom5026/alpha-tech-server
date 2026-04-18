




// ✅ routes/authRoutes.js 
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

// ✅ กัน error: handler ต้องเป็น function เท่านั้น
const ensureFn = (key) => {
  const fn = authController?.[key];
  if (typeof fn === 'function') return fn;
  throw new Error(`[authRoutes] authController.${key} must be a function (got ${typeof fn})`);
};

// บางครั้ง controller อาจ export เป็น object (เช่น { handler })
const resolveHandler = (key) => {
  const v = authController?.[key];
  if (typeof v === 'function') return v;
  if (v && typeof v.handler === 'function') return v.handler;
  if (v && typeof v.handle === 'function') return v.handle;
  if (v && typeof v.fn === 'function') return v.fn;
  return null;
};

const login = ensureFn('login');
const register = ensureFn('register');
const refreshSession = ensureFn('refreshSession');
const logoutSession = ensureFn('logoutSession');
const revokeSession = resolveHandler('revokeSession') || resolveHandler('logoutAllSessions') || resolveHandler('logoutAll');
const findUserByEmail = resolveHandler('findUserByEmail');
if (typeof findUserByEmail !== 'function') {
  throw new Error(`[authRoutes] authController.findUserByEmail must be a function (got ${typeof findUserByEmail})`);
}
// ✅ verifyToken: single export (CommonJS)
const verifyToken = require('../middlewares/verifyToken');


// 🔐 Login / Register / Session
router.post('/login', login);
router.post('/register', register);

// Remember Me / session persistence hooks
router.post('/refresh', refreshSession);
router.post('/logout', logoutSession);



if (typeof revokeSession === 'function') {
  router.post('/logout-all', verifyToken, revokeSession);
}

// 🔍 Find user by email (for employee approval)
router.get('/users/find', verifyToken, findUserByEmail);

// ✅ Current session / bootstrap auth
const getMe = ensureFn('getMe');
const forgotPassword = ensureFn('forgotPassword');
const resetPassword = ensureFn('resetPassword');
router.get('/me', verifyToken, getMe);

// 🔁 Forgot / Reset Password
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;






