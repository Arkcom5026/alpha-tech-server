// src/modules/auth/routes/authRoutes.js
// Canonical Auth route owner for both the current /api/auth contract and tenant-login compatibility.

const express = require('express');

const authController = require('../../../../controllers/authController');
const employeeOnboardingController = require('../../../../controllers/employeeOnboardingController');
const tenantAuthController = require('../controllers/authController');
const verifyToken = require('../../../../middlewares/verifyToken');
const { traceRefreshRequest } = require('../../../../middlewares/authTrace');
const tenantContext = require('../../../middlewares/tenantContext');

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
  throw new Error(`[authRoutes] authController.${key} must be a function (got ${typeof fn})`);
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
const register = ensureFn('register');
const refreshSession = ensureFn('refreshSession');
const logoutSession = ensureFn('logoutSession');
const addSubEmployee = employeeOnboardingController.addSubEmployee;
const revokeSession = resolveHandler('revokeSession') || resolveHandler('logoutAllSessions') || resolveHandler('logoutAll');
const findUserByEmail = resolveHandler('findUserByEmail');
const getMe = ensureFn('getMe');
const forgotPassword = ensureFn('forgotPassword');
const resetPassword = ensureFn('resetPassword');

if (typeof addSubEmployee !== 'function') {
  throw new Error('[authRoutes] employeeOnboardingController.addSubEmployee must be a function');
}

if (typeof findUserByEmail !== 'function') {
  throw new Error(`[authRoutes] authController.findUserByEmail must be a function (got ${typeof findUserByEmail})`);
}

// Current canonical /api/auth contract.
router.post('/login', login);
router.post('/register', register);
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

// Existing tenant-login responsibility retained under the same canonical route owner.
router.post('/:tenant_slug/auth/login', tenantContext, tenantAuthController.login);

module.exports = router;
