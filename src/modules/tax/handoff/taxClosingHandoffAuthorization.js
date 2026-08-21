'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_CLOSING_HANDOFF_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_CLOSING_HANDOFF_READ,
  FINALIZE: POSITION_CAPABILITIES.TAX_CLOSING_HANDOFF_FINALIZE,
});

const allowTaxClosingHandoffCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities
    .map((capability) => String(capability || '').trim())
    .filter(Boolean);

  const allowed = required.length > 0
    && required.every((capability) => hasCapability(req.user || {}, capability));

  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์ดำเนินการส่งมอบงานปิดภาษี',
      code: 'TAX_CLOSING_HANDOFF_FORBIDDEN',
      requiredCapabilities: required,
    });
  }

  return next();
};

module.exports = Object.freeze({
  TAX_CLOSING_HANDOFF_CAPABILITY,
  allowTaxClosingHandoffCapabilities,
});
