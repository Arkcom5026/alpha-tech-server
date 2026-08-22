'use strict';

const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../../employee/authorization/employeePositionResidualAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const createForbiddenPayload = (requiredCapabilities) => ({
  success: false,
  code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
  message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  details: { requiredCapabilities },
});

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasResidualCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return res.status(403).json(createForbiddenPayload(requiredCapabilities));
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
