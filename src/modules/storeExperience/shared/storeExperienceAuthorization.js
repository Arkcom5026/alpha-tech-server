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

const normalize = (value) => String(value || '').trim().toUpperCase();

const hasLegacyEmployeeContext = (actor = {}) => (
  String(actor.profileType || '').trim().toLowerCase() === 'employee'
  || normalize(actor.role) === 'EMPLOYEE'
  || (Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0)
);

const hasStoreExperienceCapability = (actor = {}, capability) => {
  if (Array.isArray(actor.positionCapabilities)) {
    return hasCapability(actor, capability);
  }

  const systemRole = normalize(actor.role);
  if (actor.isSuperAdmin === true || ['ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(systemRole)) {
    return true;
  }

  // Historical store-experience routes allowed every authenticated employee
  // to read, edit, publish and upload media. Preserve that behavior only while
  // the position capability array is still null/missing.
  if (hasLegacyEmployeeContext(actor)) return true;

  return false;
};

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter(
    (capability) => !hasStoreExperienceCapability(req.user || {}, capability),
  );

  if (missing.length === 0) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    requiredCapabilities,
  });
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  hasStoreExperienceCapability,
  allowStoreExperienceCapabilities,
};
