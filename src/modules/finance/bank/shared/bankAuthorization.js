'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const BANK_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.FINANCE_BANK_READ,
  MANAGE: POSITION_CAPABILITIES.FINANCE_BANK_MANAGE,
  DELETE: POSITION_CAPABILITIES.FINANCE_BANK_DELETE,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('BANK_ACCESS_FORBIDDEN');
  error.code = 'BANK_ACCESS_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowBankCapabilities = (...requiredCapabilities) => (req, _res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  BANK_CAPABILITY,
  allowBankCapabilities,
};
