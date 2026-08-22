'use strict';

const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  hasResidualBusinessCapability,
} = require('../../employee/authorization/residualBusinessPositionAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const createForbiddenPayload = (requiredCapabilities) => ({
  success: false,
  code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
  message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  details: { requiredCapabilities },
});

const requireStoreExperienceEmployeeContext = (req, res, next) => {
  const employeeId = Number(req?.user?.employeeId);
  const branchId = Number(req?.user?.branchId);
  const valid =
    String(req?.user?.profileType || '').trim().toLowerCase() === 'employee' &&
    Number.isInteger(employeeId) && employeeId > 0 &&
    Number.isInteger(branchId) && branchId > 0;

  if (!valid) return res.status(403).json(createForbiddenPayload([]));
  return next();
};

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter(
    (capability) => !hasResidualBusinessCapability(req.user || {}, capability),
  );

  if (missing.length > 0) {
    return res.status(403).json(createForbiddenPayload(requiredCapabilities));
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  requireStoreExperienceEmployeeContext,
  allowStoreExperienceCapabilities,
};
