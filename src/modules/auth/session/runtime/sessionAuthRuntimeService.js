const legacyAuthController = require('../../../../../controllers/authController');

const resolveHandler = (key) => {
  const value = legacyAuthController?.[key];
  if (typeof value === 'function') return value;
  if (value && typeof value.handler === 'function') return value.handler;
  if (value && typeof value.handle === 'function') return value.handle;
  if (value && typeof value.fn === 'function') return value.fn;
  return null;
};

const requireHandler = (key) => {
  const handler = resolveHandler(key);
  if (typeof handler !== 'function') {
    throw new Error(
      `[sessionAuthRuntimeService] authController.${key} must resolve to a function`
    );
  }
  return handler;
};

const login = requireHandler('login');
const register = requireHandler('register');
const refreshSession = requireHandler('refreshSession');
const logoutSession = requireHandler('logoutSession');
const getMe = requireHandler('getMe');
const forgotPassword = requireHandler('forgotPassword');
const resetPassword = requireHandler('resetPassword');
const findUserByEmail = requireHandler('findUserByEmail');
const revokeSession = resolveHandler('revokeSession')
  || resolveHandler('logoutAllSessions')
  || resolveHandler('logoutAll');

module.exports = {
  login,
  register,
  refreshSession,
  logoutSession,
  getMe,
  forgotPassword,
  resetPassword,
  findUserByEmail,
  revokeSession,
};
