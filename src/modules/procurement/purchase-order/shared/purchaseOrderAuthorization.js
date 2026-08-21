const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const PURCHASE_ORDER_CAPABILITY = Object.freeze({
  ACCESS: POSITION_CAPABILITIES.PROCUREMENT_PURCHASE_ORDER,
  CONTROL: POSITION_CAPABILITIES.PROCUREMENT_PURCHASE_ORDER_CONTROL,
});

const buildForbiddenError = (requiredCapabilities) => {
  const error = new Error('ไม่มีสิทธิ์ดำเนินการใบสั่งซื้อ');
  error.code = 'PURCHASE_ORDER_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowPurchaseOrderCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user, capability));
  if (missing.length === 0) return next();
  return next(buildForbiddenError(requiredCapabilities));
};

module.exports = {
  PURCHASE_ORDER_CAPABILITY,
  allowPurchaseOrderCapabilities,
};
