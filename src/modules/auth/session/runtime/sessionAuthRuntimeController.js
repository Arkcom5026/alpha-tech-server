const service = require('./sessionAuthRuntimeService');

module.exports = {
  login: service.login,
  register: service.register,
  refreshSession: service.refreshSession,
  logoutSession: service.logoutSession,
  getMe: service.getMe,
  forgotPassword: service.forgotPassword,
  resetPassword: service.resetPassword,
  findUserByEmail: service.findUserByEmail,
  revokeSession: service.revokeSession,
};
