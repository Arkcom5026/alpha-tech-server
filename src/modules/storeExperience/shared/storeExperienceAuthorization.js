'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const allowStoreExperienceContext = (req, res, next) => {
  const role = normalizeUpper(req?.user?.role);
  const nestedRole = normalizeUpper(req?.employee?.role);
  const employeeProfile = String(req?.user?.profileType || '').trim().toLowerCase() === 'employee';
  const accountContext = employeeProfile
    || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)
    || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(nestedRole);

  if (accountContext) return next();
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  });
};

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );
  if (missing.length === 0) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_CAPABILITY',
    message: 'ไม่มีสิทธิ์ดำเนินการหน้าร้าน',
    details: { requiredCapabilities },
  });
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceContext,
  allowStoreExperienceCapabilities,
};
