const { listEmployees } = require('./listEmployeeRepository');
const { employeeProjection } = require('../../shared/employeeMapper');
const { isSuperAdmin, toInt, toPrismaRole } = require('../../shared/employeeUtils');

const statusWhere = (status) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'pending': return { approved: false };
    case 'active': return { approved: true, active: true };
    case 'inactive': return { approved: true, active: false };
    default: return {};
  }
};

const listEmployeeProfiles = async ({ actor, query }) => {
  const actorBranchId = toInt(actor.branchId);
  const requestedBranchId = toInt(query.branchId);
  const q = String(query.q ?? query.search ?? '').trim();
  const role = query.role ? toPrismaRole(query.role) : null;
  const status = String(query.status || '').trim().toLowerCase();
  const page = Math.max(Number.parseInt(query.page || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '20', 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const filters = [];

  if (isSuperAdmin(actor)) {
    if (requestedBranchId) filters.push({ branchId: requestedBranchId });
  } else {
    filters.push({ branchId: actorBranchId || -1 });
  }

  if (q) {
    filters.push({ OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { user: { loginId: { contains: q, mode: 'insensitive' } } },
    ] });
  }

  if (role) filters.push({ user: { role } });
  if (status && status !== 'all') filters.push(statusWhere(status));

  const where = filters.length ? { AND: filters } : {};
  const [itemsRaw, total] = await listEmployees({ where, skip, take: limit });

  return {
    items: itemsRaw.map(employeeProjection),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
};

module.exports = { listEmployeeProfiles };
