'use strict';

const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../employee/authorization/residualPositionAuthority');

const STORE_EXPERIENCE_CAPABILITIES = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter(
    (capability) => !hasResidualCapability(req.user || {}, capability),
  );

  if (missing.length === 0) return next();

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    details: { requiredCapabilities },
  });
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITIES,
  allowStoreExperienceCapabilities,
};
