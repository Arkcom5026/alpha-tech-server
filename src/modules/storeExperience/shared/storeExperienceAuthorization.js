'use strict';

const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveResidualCapability,
} = require('../../employee/authorization/operationalResidualAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
  MEDIA: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_MEDIA,
});

const hasEmployeeContext = (actor = {}) => (
  String(actor.profileType || '').trim().toLowerCase() === 'employee' &&
  Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0
);

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const actor = req.user || {};
  const platformRole = String(actor.role || '').trim().toUpperCase();
  const isPlatformAdmin = actor.isSuperAdmin === true || ['ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(platformRole);

  if (!isPlatformAdmin && !hasEmployeeContext(actor)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
      message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    });
  }

  const allowed = requiredCapabilities.every((capability) => resolveResidualCapability(
    actor,
    capability,
    { legacyRoles: ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'] },
  ));

  if (!allowed) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
      message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    });
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
