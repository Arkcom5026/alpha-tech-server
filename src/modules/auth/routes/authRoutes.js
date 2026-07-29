// src/modules/auth/routes/authRoutes.js
// Canonical Auth route owner for both the current /api/auth contract and tenant-login compatibility.

const express = require('express');

const legacyAuthController = require('../../../../controllers/authController');
const employeeOnboardingController = require('../../../../controllers/employeeOnboardingController');
const loginController = require('../login/loginController');
const registrationController = require('../registration/registrationController');
const sessionController = require('../session/sessionController');
const passwordController = require('../password/passwordController');
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

const ensureLegacyFn = (key) => {
  const fn = legacyAuthController?.[key];
  if (typeof fn === 'function') return fn;
  throw new Error(`[authRoutes] legacyAuthController.${key} must be a function (got ${typeof fn})`);
};

const resolveLegacyHandler = (key) => {
  const value = legacyAuthController?.[key];
  if (typeof value === 'function') return value;
  if (value && typeof value.handler === 'function') return value.handler;
  if (value && typeof value.handle === 'function') return value.handle;
  if (value && typeof value.fn === 'function') return value.fn;
  return null;
};

const addSubEmployee = employeeOnboardingController.addSubEmployee;
const findUserByEmail = resolveLegacyHandler('findUserByEmail');
const getMe = ensureLegacyFn('getMe');

if (typeof loginController.login !== 'function') {
  throw new Error('[authRoutes] loginController.login must be a function');
}

if (typeof registrationController.register !== 'function') {
  throw new Error('[authRoutes] registrationController.register must be a function');
}

for (const handlerName of ['refreshSession', 'logoutSession', 'revokeSession']) {
  if (typeof sessionController[handlerName] !== 'function') {
    throw new Error(`[authRoutes] sessionController.${handlerName} must be a function`);
  }
}

for (const handlerName of ['forgotPassword', 'resetPassword']) {
  if (typeof passwordController[handlerName] !== 'function') {
    throw new Error(`[authRoutes] passwordController.${handlerName} must be a function`);
  }
}

if (typeof addSubEmployee !== 'function') {
  throw new Error('[authRoutes] employeeOnboardingController.addSubEmployee must be a function');
}

if (typeof findUserByEmail !== 'function') {
  throw new Error(
    `[authRoutes] legacyAuthController.findUserByEmail must be a function (got ${typeof findUserByEmail})`,
  );
}

// Current canonical /api/auth contract.
router.post('/login', loginController.login);
router.post('/register', registrationController.register);
router.post('/refresh', traceRefreshRequest, sessionController.refreshSession);
router.post('/logout', sessionController.logoutSession);
router.post('/add-sub-employee', verifyToken, addSubEmployee);
router.post('/logout-all', verifyToken, sessionController.revokeSession);
router.get('/users/find', verifyToken, findUserByEmail);
router.get('/me', verifyToken, getMe);
router.post('/forgot-password', passwordController.forgotPassword);
router.post('/reset-password', passwordController.resetPassword);

// Existing tenant-login responsibility retained under the same canonical route owner.
router.post('/:tenant_slug/auth/login', tenantContext, tenantAuthController.login);

module.exports = router;
