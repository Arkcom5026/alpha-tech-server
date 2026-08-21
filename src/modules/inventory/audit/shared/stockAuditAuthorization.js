const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const STOCK_AUDIT_CAPABILITY = Object.freeze({
  ACCESS: POSITION_CAPABILITIES.INVENTORY_AUDIT,
  FINALIZE: POSITION_CAPABILITIES.INVENTORY_AUDIT_FINALIZE,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('STOCK_AUDIT_FORBIDDEN');
  error.code = 'STOCK_AUDIT_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowStockAuditCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  STOCK_AUDIT_CAPABILITY,
  allowStockAuditCapabilities,
};
