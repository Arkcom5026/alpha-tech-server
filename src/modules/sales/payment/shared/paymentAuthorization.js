const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const PAYMENT_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.SALES_PAYMENT_READ,
  MANAGE: POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE,
  CANCEL: POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL,
});

const deny = (res, requiredCapabilities) => res.status(403).json({
  code: 'SALES_PAYMENT_FORBIDDEN',
  message: 'You do not have permission to access sales payments',
  details: { requiredCapabilities },
});

const allowPaymentCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities.filter(Boolean);
  if (!required.every((capability) => hasCapability(req.user, capability))) {
    return deny(res, required);
  }
  return next();
};

module.exports = {
  PAYMENT_CAPABILITY,
  allowPaymentCapabilities,
};
