// @filename: src/modules/employee/policies/employeeAuthorityPolicy.js
// Employee authority policy boundary.
// Keeps employee permission decisions out of controllers during migration.

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const canManageEmployees = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  const employeeRole = normalizeUpper(
    actor.employeeRole || actor.employeeProfile?.role,
  );

  return Boolean(
    actor.isSuperAdmin
      || systemRole === 'SUPERADMIN'
      || systemRole === 'ADMIN'
      || employeeRole === 'OWNER'
      || employeeRole === 'MANAGER'
  );
};

module.exports = {
  canManageEmployees,
};
