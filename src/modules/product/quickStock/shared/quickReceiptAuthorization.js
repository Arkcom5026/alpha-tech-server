const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const QUICK_RECEIPT_CAPABILITY = Object.freeze({
  ACCESS: POSITION_CAPABILITIES.INVENTORY_QUICK_RECEIPT,
  FINALIZE: POSITION_CAPABILITIES.INVENTORY_QUICK_RECEIPT_FINALIZE,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('QUICK_RECEIPT_FORBIDDEN');
  error.code = 'QUICK_RECEIPT_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowQuickReceiptCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  QUICK_RECEIPT_CAPABILITY,
  allowQuickReceiptCapabilities,
};
