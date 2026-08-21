'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const SALES_TAX_FILING_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ,
  PREPARE: POSITION_CAPABILITIES.TAX_OUTPUT_FILING_PREPARE,
  SUBMIT: POSITION_CAPABILITIES.TAX_OUTPUT_FILING_SUBMIT,
});

const allowSalesTaxFilingCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities
    .map((capability) => String(capability || '').trim())
    .filter(Boolean);

  const allowed = required.length > 0
    && required.every((capability) => hasCapability(req.user || {}, capability));

  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์ดำเนินการด้านการยื่นภาษีขาย',
      code: 'SALES_TAX_FILING_FORBIDDEN',
      requiredCapabilities: required,
    });
  }

  return next();
};

module.exports = Object.freeze({
  SALES_TAX_FILING_CAPABILITY,
  allowSalesTaxFilingCapabilities,
});
