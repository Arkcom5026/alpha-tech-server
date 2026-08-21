'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const OUTPUT_TAX_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_OUTPUT_READ,
  PREPARE: POSITION_CAPABILITIES.TAX_OUTPUT_PREPARE,
  ISSUE: POSITION_CAPABILITIES.TAX_OUTPUT_ISSUE,
  CREDIT_NOTE: POSITION_CAPABILITIES.TAX_OUTPUT_CREDIT_NOTE,
  LIFECYCLE: POSITION_CAPABILITIES.TAX_OUTPUT_LIFECYCLE,
});

const allowOutputTaxCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities
    .map((capability) => String(capability || '').trim())
    .filter(Boolean);

  const allowed = required.length > 0
    && required.every((capability) => hasCapability(req.user || {}, capability));

  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์ดำเนินการด้านเอกสารภาษีขาย',
      code: 'OUTPUT_TAX_FORBIDDEN',
      requiredCapabilities: required,
    });
  }

  return next();
};

module.exports = Object.freeze({
  OUTPUT_TAX_CAPABILITY,
  allowOutputTaxCapabilities,
});
