const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const SUPPLIER_PAYMENT_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_READ,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('SUPPLIER_PAYMENT_READ_FORBIDDEN');
  error.code = 'SUPPLIER_PAYMENT_READ_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowSupplierPaymentCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  SUPPLIER_PAYMENT_CAPABILITY,
  allowSupplierPaymentCapabilities,
};
