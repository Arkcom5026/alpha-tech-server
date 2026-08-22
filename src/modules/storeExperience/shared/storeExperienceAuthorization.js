'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
  resolveActorCapabilities,
} = require('../../employee/authorization/employeePositionAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
  MEDIA: POSITION_CAPABILITIES.STORE_EXPERIENCE_MEDIA,
});

const isLegacyEmployeeContext = (actor = {}) => (
  resolveActorCapabilities(actor).mode === 'V2_ROLE_COMPAT'
  && String(actor.profileType || '').trim().toLowerCase() === 'employee'
);

const hasStoreExperienceCapability = (actor, capability) => (
  isLegacyEmployeeContext(actor) || hasCapability(actor, capability)
);

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasStoreExperienceCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
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
  hasStoreExperienceCapability,
  allowStoreExperienceCapabilities,
};
