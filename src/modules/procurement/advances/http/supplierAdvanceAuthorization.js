'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const SUPPLIER_ADVANCE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_ADVANCE_READ,
  MANAGE: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_ADVANCE_MANAGE,
  CONTROL: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_ADVANCE_CONTROL,
});

const requireCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (!missingCapabilities.length) return next();

  return res.status(403).json({
    code: 'SUPPLIER_ADVANCE_ACCESS_FORBIDDEN',
    message: 'ไม่มีสิทธิ์ดำเนินการเงินจ่ายล่วงหน้า Supplier',
    requiredCapabilities,
    missingCapabilities,
  });
};

const requireSupplierAdvanceRead = requireCapabilities(
  SUPPLIER_ADVANCE_CAPABILITY.READ,
);

const requireSupplierAdvanceManage = requireCapabilities(
  SUPPLIER_ADVANCE_CAPABILITY.READ,
  SUPPLIER_ADVANCE_CAPABILITY.MANAGE,
);

const requireSupplierAdvanceControl = requireCapabilities(
  SUPPLIER_ADVANCE_CAPABILITY.READ,
  SUPPLIER_ADVANCE_CAPABILITY.MANAGE,
  SUPPLIER_ADVANCE_CAPABILITY.CONTROL,
);

module.exports = Object.freeze({
  SUPPLIER_ADVANCE_CAPABILITY,
  requireCapabilities,
  requireSupplierAdvanceRead,
  requireSupplierAdvanceManage,
  requireSupplierAdvanceControl,
});