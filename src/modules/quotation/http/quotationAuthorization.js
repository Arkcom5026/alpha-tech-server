'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const QUOTATION_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.QUOTATION_READ,
  MANAGE: POSITION_CAPABILITIES.QUOTATION_MANAGE,
  ISSUE: POSITION_CAPABILITIES.QUOTATION_ISSUE,
  LIFECYCLE: POSITION_CAPABILITIES.QUOTATION_LIFECYCLE,
});

const allowQuotationCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user, capability),
  );

  if (missingCapabilities.length > 0) {
    return res.status(403).json({
      ok: false,
      code: 'QUOTATION_AUTHORITY_FORBIDDEN',
      message: 'ไม่มีสิทธิ์ดำเนินการใบเสนอราคาในขอบเขตนี้',
      details: { requiredCapabilities },
    });
  }

  return next();
};

module.exports = {
  QUOTATION_CAPABILITY,
  allowQuotationCapabilities,
};
