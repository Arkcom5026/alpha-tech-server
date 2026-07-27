const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number.parseInt(value, 10)
);

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isSuperAdmin = (actor = {}) => Boolean(
  actor.isSuperAdmin || normalizeRole(actor.role) === 'superadmin'
);

const isStaffRole = (role) => new Set(['superadmin', 'admin', 'employee']).has(normalizeRole(role));

const toPrismaRole = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'supperadmin' || normalized === 'superadmin') return 'SUPERADMIN';
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'employee') return 'EMPLOYEE';
  if (normalized === 'customer') return 'CUSTOMER';
  return null;
};

const resolveManagedBranchId = (actor, requestedBranchId) => {
  if (isSuperAdmin(actor)) return toInt(requestedBranchId);

  const actorBranchId = toInt(actor?.branchId);
  const mainBranchId = toInt(process.env.MAIN_BRANCH_ID);
  const isMainBranchEmployee = normalizeRole(actor?.role) === 'employee'
    && actorBranchId
    && mainBranchId
    && actorBranchId === mainBranchId;

  if (isMainBranchEmployee && toInt(requestedBranchId)) return toInt(requestedBranchId);
  return actorBranchId;
};

module.exports = {
  normalizeRole,
  toInt,
  toPositiveInt,
  isSuperAdmin,
  isStaffRole,
  toPrismaRole,
  resolveManagedBranchId,
};
