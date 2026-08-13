const express = require('express');

const authController = require('../session/runtime/sessionAuthRuntimeController');
const employeeOnboardingController = require('../../employee/onboarding/runtime/employeeOnboardingRuntimeController');
const verifyToken = require('../../../../middlewares/verifyToken');
const { traceRefreshRequest } = require('../../../../middlewares/authTrace');

const router = express.Router();
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');
const isProduction = process.env.NODE_ENV === 'production';

const getRefreshCookieTransportOptions = () => ({
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
});

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

const ensureFn = (key) => {
  const fn = authController?.[key];
  if (typeof fn === 'function') return fn;
  throw new Error(`[sessionAuthRoutes] authController.${key} must be a function (got ${typeof fn})`);
};

const resolveHandler = (key) => {
  const value = authController?.[key];
  if (typeof value === 'function') return value;
  if (value && typeof value.handler === 'function') return value.handler;
  if (value && typeof value.handle === 'function') return value.handle;
  if (value && typeof value.fn === 'function') return value.fn;
  return null;
};

const login = ensureFn('login');
const refreshSession = ensureFn('refreshSession');
const logoutSession = ensureFn('logoutSession');
const getMe = ensureFn('getMe');
const forgotPassword = ensureFn('forgotPassword');
const resetPassword = ensureFn('resetPassword');
const addSubEmployee = employeeOnboardingController.addSubEmployee;
const revokeSession = resolveHandler('revokeSession')
  || resolveHandler('logoutAllSessions')
  || resolveHandler('logoutAll');
const findUserByEmail = resolveHandler('findUserByEmail');

if (typeof addSubEmployee !== 'function') {
  throw new Error('[sessionAuthRoutes] employeeOnboardingController.addSubEmployee must be a function');
}

if (typeof findUserByEmail !== 'function') {
  throw new Error(`[sessionAuthRoutes] authController.findUserByEmail must be a function (got ${typeof findUserByEmail})`);
}

const retiredGenericRegister = (req, res) => res.status(410).json({
  success: false,
  code: 'AUTH_REGISTER_BOUNDARY_RETIRED',
  message: 'การลงทะเบียนแบบทั่วไปถูกยกเลิก กรุณาใช้ขั้นตอนลงทะเบียนเฉพาะประเภทบัญชี',
});

router.post('/login', login);
router.post('/register', retiredGenericRegister);
router.post('/refresh', traceRefreshRequest, refreshSession);
router.post('/logout', logoutSession);
router.post('/add-sub-employee', verifyToken, addSubEmployee);

if (typeof revokeSession === 'function') {
  router.post('/logout-all', verifyToken, revokeSession);
}

router.get('/users/find', verifyToken, findUserByEmail);
router.get('/me', verifyToken, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
