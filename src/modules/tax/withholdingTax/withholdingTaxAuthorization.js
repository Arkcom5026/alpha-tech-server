'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_WITHHOLDING_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_WITHHOLDING_READ,
  TREATMENT: POSITION_CAPABILITIES.TAX_WITHHOLDING_TREATMENT,
  CERTIFICATE_ISSUE: POSITION_CAPABILITIES.TAX_WITHHOLDING_CERTIFICATE_ISSUE,
  FILING_PREPARE: POSITION_CAPABILITIES.TAX_WITHHOLDING_FILING_PREPARE,
  FILING_SUBMIT: POSITION_CAPABILITIES.TAX_WITHHOLDING_FILING_SUBMIT,
});

const allowWithholdingTaxCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์ดำเนินการภาษีหัก ณ ที่จ่าย',
    code: 'WHT_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_WITHHOLDING_CAPABILITY,
  allowWithholdingTaxCapabilities,
});
