'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_ACCOUNTING_OFFICE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_ACCOUNTING_OFFICE_READ,
});

const allowAccountingOfficeCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์เข้าถึงชุดข้อมูลสำหรับสำนักงานบัญชี',
    code: 'ACCOUNTING_OFFICE_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_ACCOUNTING_OFFICE_CAPABILITY,
  allowAccountingOfficeCapabilities,
});
