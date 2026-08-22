'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const isStoreExperienceEmployeeContext = (req = {}) => {
  const role = normalizeUpper(req?.user?.role);
  const employeeRole = normalizeUpper(req?.employee?.role);
  const profileType = String(req?.user?.profileType || '').trim().toLowerCase();

  return profileType === 'employee'
    || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)
    || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(employeeRole);
};

const allowStoreExperienceManage = (req, res, next) => {
  if (!isStoreExperienceEmployeeContext(req)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
      message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
    });
  }

  const role = normalizeUpper(req?.user?.role);
  if (['ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)) return next();

  if (hasCapability(req?.user || {}, POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  });
};

module.exports = {
  isStoreExperienceEmployeeContext,
  allowStoreExperienceManage,
};
