'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_PERIOD_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_PERIOD_READ,
  MANAGE: POSITION_CAPABILITIES.TAX_PERIOD_MANAGE,
  REOPEN: POSITION_CAPABILITIES.TAX_PERIOD_REOPEN,
});

const allowTaxPeriodCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities
    .map((capability) => String(capability || '').trim())
    .filter(Boolean);

  const allowed = required.length > 0
    && required.every((capability) => hasCapability(req.user || {}, capability));

  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์จัดการงวดภาษี',
      code: 'TAX_PERIOD_FORBIDDEN',
      requiredCapabilities: required,
    });
  }

  return next();
};

module.exports = Object.freeze({
  TAX_PERIOD_CAPABILITY,
  allowTaxPeriodCapabilities,
});
