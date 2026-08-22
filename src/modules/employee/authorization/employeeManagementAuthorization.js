'use strict';

const {
  POSITION_CAPABILITIES,
  resolveActorCapabilities,
  hasCapability,
} = require('./employeePositionAuthority');

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const hasLegacyGenericEmployeeMutationAccess = (actor = {}) => {
  const role = normalizeUpper(actor.role);
  return ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)
    || actor.isSuperAdmin === true;
};

const canManageEmployees = (actor = {}) => {
  const resolved = resolveActorCapabilities(actor);

  if (resolved.mode === 'POSITION') {
    return hasCapability(actor, POSITION_CAPABILITIES.EMPLOYEE_MANAGE);
  }

  if (resolved.mode === 'SYSTEM_ROLE') return true;

  // The legacy generic /employees mutation surface historically accepted any
  // authenticated employee account. Keep that behavior only while the actor's
  // Position is still unmigrated; once Position capabilities are non-null,
  // employee.manage becomes authoritative (including an explicit empty array).
  return hasLegacyGenericEmployeeMutationAccess(actor);
};

const allowEmployeeManagement = (req, res, next) => {
  if (canManageEmployees(req.user || {})) return next();

  return res.status(403).json({
    code: 'EMPLOYEE_MANAGEMENT_FORBIDDEN',
    message: 'ตำแหน่งของบัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน',
    details: { requiredCapabilities: [POSITION_CAPABILITIES.EMPLOYEE_MANAGE] },
  });
};

module.exports = {
  canManageEmployees,
  allowEmployeeManagement,
};
