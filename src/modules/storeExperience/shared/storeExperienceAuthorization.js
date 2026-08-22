'use strict';

const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  hasOperationalResidualCapability,
} = require('../../employee/authorization/operationalResidualAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const employeeId = Number(req.user?.employeeId);
  const branchId = Number(req.user?.branchId);
  const validEmployeeContext =
    req.user?.profileType === 'employee' &&
    Number.isInteger(employeeId) && employeeId > 0 &&
    Number.isInteger(branchId) && branchId > 0;

  const missing = requiredCapabilities.filter(
    (capability) => !hasOperationalResidualCapability(req.user || {}, capability),
  );

  const platformRole = String(req.user?.role || '').trim().toUpperCase();
  const platformAdmin = ['ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(platformRole) || req.user?.isSuperAdmin === true;

  if ((!validEmployeeContext && !platformAdmin) || missing.length > 0) {
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
