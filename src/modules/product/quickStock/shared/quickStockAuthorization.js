const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const QUICK_STOCK_CAPABILITY = Object.freeze({
  MUTATE: POSITION_CAPABILITIES.INVENTORY_QUICK_STOCK,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('QUICK_STOCK_MUTATION_FORBIDDEN');
  error.code = 'QUICK_STOCK_MUTATION_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowQuickStockCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  QUICK_STOCK_CAPABILITY,
  allowQuickStockCapabilities,
};
