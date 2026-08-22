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

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasResidualBusinessCapability(req.user || {}, capability),
  );
  if (missingCapabilities.length === 0) return next();
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    details: { requiredCapabilities },
  });
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
