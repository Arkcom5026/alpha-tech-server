const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const STOCK_ITEM_CAPABILITY = Object.freeze({
  RECEIVE: POSITION_CAPABILITIES.INVENTORY_RECEIVE,
  LIFECYCLE: POSITION_CAPABILITIES.INVENTORY_LIFECYCLE,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('STOCK_ITEM_FORBIDDEN');
  error.code = 'STOCK_ITEM_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowStockItemCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  STOCK_ITEM_CAPABILITY,
  allowStockItemCapabilities,
};
