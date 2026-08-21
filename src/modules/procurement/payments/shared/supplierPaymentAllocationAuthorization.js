'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const MANAGE = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_MANAGE;
const VOID = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_VOID;

const requireCapability = (capability, code, message) => (req, res, next) => {
  if (hasCapability(req.user || {}, capability)) return next();
  return res.status(403).json({
    code,
    message,
    requiredCapability: capability,
  });
};

const requireSupplierPaymentManage = requireCapability(
  MANAGE,
  'SUPPLIER_PAYMENT_ACCESS_FORBIDDEN',
  'ไม่มีสิทธิ์จัดการการชำระ Supplier',
);

const requireSupplierPaymentVoid = requireCapability(
  VOID,
  'SUPPLIER_PAYMENT_VOID_FORBIDDEN',
  'ไม่มีสิทธิ์ยกเลิกรายการชำระ Supplier',
);

module.exports = Object.freeze({
  MANAGE,
  VOID,
  requireSupplierPaymentManage,
  requireSupplierPaymentVoid,
});
