'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('./employeePositionAuthority');

const requireEmployeeManage = (req, res, next) => {
  if (hasCapability(req.user || {}, POSITION_CAPABILITIES.EMPLOYEE_MANAGE)) return next();

  return res.status(403).json({
    code: 'EMPLOYEE_MANAGE_FORBIDDEN',
    message: 'ตำแหน่งของบัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน',
  });
};

module.exports = {
  requireEmployeeManage,
};
