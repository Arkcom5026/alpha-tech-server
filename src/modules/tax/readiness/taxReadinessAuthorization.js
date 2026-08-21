'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_READINESS_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_READINESS_READ,
});

const allowTaxReadinessCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์เข้าถึงภาพรวมความพร้อมด้านภาษี',
    code: 'TAX_READINESS_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_READINESS_CAPABILITY,
  allowTaxReadinessCapabilities,
});
