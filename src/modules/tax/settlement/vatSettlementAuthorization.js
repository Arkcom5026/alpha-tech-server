'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_VAT_SETTLEMENT_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_VAT_SETTLEMENT_READ,
});

const allowVatSettlementCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user || {}, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    error: 'ไม่มีสิทธิ์เข้าถึงการเตรียมยอดภาษีมูลค่าเพิ่ม',
    code: 'VAT_SETTLEMENT_ACCESS_FORBIDDEN',
    requiredCapabilities,
  });
};

module.exports = Object.freeze({
  TAX_VAT_SETTLEMENT_CAPABILITY,
  allowVatSettlementCapabilities,
});
