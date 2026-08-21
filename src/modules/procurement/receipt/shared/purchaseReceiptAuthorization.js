const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const PURCHASE_RECEIPT_CAPABILITY = Object.freeze({
  ACCESS: POSITION_CAPABILITIES.PROCUREMENT_RECEIPT,
  FINALIZE: POSITION_CAPABILITIES.PROCUREMENT_RECEIPT_FINALIZE,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('PURCHASE_RECEIPT_FORBIDDEN');
  error.code = 'PURCHASE_RECEIPT_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowPurchaseReceiptCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  PURCHASE_RECEIPT_CAPABILITY,
  allowPurchaseReceiptCapabilities,
};
