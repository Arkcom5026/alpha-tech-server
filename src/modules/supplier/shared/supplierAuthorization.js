'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const SUPPLIER_CAPABILITY = Object.freeze({
  ACCESS: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER,
  DELETE: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE,
});

const allowSupplierCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter((capability) => !hasCapability(req.user, capability));
  if (missing.length === 0) return next();

  return res.status(403).json({
    code: 'SUPPLIER_FORBIDDEN',
    message: 'ไม่มีสิทธิ์ดำเนินการข้อมูล Supplier',
    details: { requiredCapabilities },
  });
};

const allowSupplierAccess = allowSupplierCapabilities(SUPPLIER_CAPABILITY.ACCESS);
const allowSupplierDelete = allowSupplierCapabilities(
  SUPPLIER_CAPABILITY.ACCESS,
  SUPPLIER_CAPABILITY.DELETE,
);

module.exports = {
  SUPPLIER_CAPABILITY,
  allowSupplierCapabilities,
  allowSupplierAccess,
  allowSupplierDelete,
};
