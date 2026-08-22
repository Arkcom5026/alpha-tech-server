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

const createForbiddenResponse = (res, requiredCapabilities) => res.status(403).json({
  success: false,
  code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
  message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  details: { requiredCapabilities },
});

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return createForbiddenResponse(res, requiredCapabilities);
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
