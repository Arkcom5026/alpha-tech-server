'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_VAT_CARRY_FORWARD_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_VAT_CARRY_FORWARD_READ,
  CONFIRM: POSITION_CAPABILITIES.TAX_VAT_CARRY_FORWARD_CONFIRM,
});

const allowVatCarryForwardCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์เข้าถึงการยืนยันยอดภาษียกไป',
    code: 'VAT_CARRY_FORWARD_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_VAT_CARRY_FORWARD_CAPABILITY,
  allowVatCarryForwardCapabilities,
});
