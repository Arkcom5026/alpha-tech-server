'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_ISSUER_PROFILE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_ISSUER_PROFILE_READ,
  MANAGE: POSITION_CAPABILITIES.TAX_ISSUER_PROFILE_MANAGE,
});

const allowTaxIssuerProfileCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์จัดการข้อมูลผู้ออกเอกสารภาษี',
    code: 'TAX_ISSUER_PROFILE_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_ISSUER_PROFILE_CAPABILITY,
  allowTaxIssuerProfileCapabilities,
});
