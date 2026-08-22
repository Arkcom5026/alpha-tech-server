'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const FINANCE_RUNTIME_CAPABILITY = Object.freeze({
  RECEIVABLES_READ: POSITION_CAPABILITIES.FINANCE_RECEIVABLES_READ,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('FINANCE_RECEIVABLES_ACCESS_FORBIDDEN');
  error.code = 'FINANCE_RECEIVABLES_ACCESS_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowFinanceRuntimeCapabilities = (...requiredCapabilities) => (req, _res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  FINANCE_RUNTIME_CAPABILITY,
  allowFinanceRuntimeCapabilities,
};
