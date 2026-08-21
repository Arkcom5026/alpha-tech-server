const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const STOCK_ITEM_CAPABILITY = Object.freeze({
  RECEIVE: POSITION_CAPABILITIES.INVENTORY_RECEIVE,
  LIFECYCLE: POSITION_CAPABILITIES.INVENTORY_LIFECYCLE,
});

const createForbiddenError = (requiredCapabilities) => {
  const receiveOnly = requiredCapabilities.length === 1
    && requiredCapabilities[0] === STOCK_ITEM_CAPABILITY.RECEIVE;
  const code = receiveOnly ? 'STOCK_ITEM_RECEIVE_FORBIDDEN' : 'STOCK_ITEM_LIFECYCLE_FORBIDDEN';
  const error = new Error(code);
  error.code = code;
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
