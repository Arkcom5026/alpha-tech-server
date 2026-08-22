'use strict';

const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../employee/authorization/residualPositionAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  MANAGE: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const LEGACY_STORE_EXPERIENCE_ROLES = Object.freeze(['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']);

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasResidualCapability(
    req.user || {},
    capability,
    { legacyRoles: LEGACY_STORE_EXPERIENCE_ROLES },
  ));

  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
      message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
      details: { requiredCapabilities },
    });
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
