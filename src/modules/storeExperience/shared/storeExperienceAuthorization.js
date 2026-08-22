'use strict';

const AppError = require('../../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const STORE_EXPERIENCE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  PUBLISH: POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new AppError('Store experience capability is required', 403);
  error.code = 'FORBIDDEN_STORE_EXPERIENCE_ACCESS';
  error.details = { requiredCapabilities };
  return error;
};

const allowStoreExperienceCapabilities = (...requiredCapabilities) => (req, _res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
};
