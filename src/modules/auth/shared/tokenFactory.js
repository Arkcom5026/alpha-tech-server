const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRES = String(process.env.ACCESS_TOKEN_EXPIRES || '1h');

const buildAccessToken = (user, options = {}) => {
  const profile = user.employeeProfile || null;

  return jwt.sign({
    id: user.id,
    role: user.role,
    profileType: 'employee',
    profileId: profile?.id || null,
    branchId: profile?.branchId || null,
    employeeId: profile?.id || null,
    ...options,
  }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIS });
};

module.exports = {
  ACCESS_TOKEN_EXPIRES,
  buildAccessToken,
};
