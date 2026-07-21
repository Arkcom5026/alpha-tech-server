// routes/authRoutes.js 
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');
const isProduction = process.env.NODE_ENV === 'production';

const getRefreshCookieTransportOptions = () => ({
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
});

// ✅ Production-grade refresh-cookie transport guard
// FE keeps accessToken in memory and relies on /auth/refresh + HttpOnly cookie.
// Cross-domain deployments such as Vercel -> API require SameSite=None + Secure.
router.use((req, res, next) => {
  const originalCookie = res.cookie.bind(res);
  const originalClearCookie = res.clearCookie.bind(res);

  res.cookie = (name, value, options = {}) => {
    if (name === REFRESH_COOKIE_NAME) {
      return originalCookie(name, value, {
        ...options,
        ...getRefreshCookieTransportOptions(),
        httpOnly: true,
      });
    }

    return originalCookie(name, value, options);
  };

  res.clearCookie = (name, options = {}) => {
    if (name === REFRESH_COOKIE_NAME) {
      return originalClearCookie(name, {
        ...options,
        ...getRefreshCookieTransportOptions(),
        httpOnly: true,
      });
    }

    return originalClearCookie(name, options);
  };

  next();
});

// ✅ กัน error: handler ต้องเป็น function เท่านั้น
const ensureFn = (key) => {
  const fn = authController?.[key];
  if (typeof fn === 'function') return fn;
  throw new Error(`[authRoutes] authController.${key} must be a function (got ${typeof fn})`);
};

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
const addSubEmployee = ensureFn('addSubEmployee'); // 🟢 ดึงโมดูล Atomic เพิ่มพนักงานรายย่อยมาร่วมท่อขาย
const revokeSession = resolveHandler('revokeSession') || resolveHandler('logoutAllSessions') || resolveHandler('logoutAll');
const findUserByEmail = resolveHandler('findUserByEmail');

if (typeof findUserByEmail !== 'function') {
  throw new Error(`[authRoutes] authController.findUserByEmail must be a function (got ${typeof findUserByEmail})`);
}

// ✅ verifyToken: single export (CommonJS)
const verifyToken = require('../middlewares/verifyToken');

// ⚠️ TEMPORARY: Auth trace middleware for refresh endpoint
const { traceRefreshRequest, traceVerifyToken } = require('../middlewares/authTrace');

// 🔐 Login / Register / Session
router.post('/login', login);
router.post('/register', register);

// Remember Me / session persistence hooks
router.post('/refresh', traceRefreshRequest, refreshSession);
router.post('/logout', logoutSession);

// 👥 [SUB-EMPLOYEE CREATION LINK]: เจาะช่องเปิดท่อรับคำสั่งเพิ่มพนักงานย่อยฝั่งสาขา
// บังคับผ่าน Middleware 'verifyToken' เพื่อดักเช็กค่าแกะ branchId เสมอตามนโยบาย Multi-Tenancy
router.post('/add-sub-employee', verifyToken, addSubEmployee);

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
