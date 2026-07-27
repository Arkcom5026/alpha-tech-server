const { findActiveReadyAudit } = require('./getActiveAuditRepository');

const getActiveAudit = async ({ branchId, repository = findActiveReadyAudit }) => {
  if (!Number.isFinite(branchId)) {
    return { status: 401, body: { message: 'Unauthorized: missing branchId' } };
  }

  const session = await repository({ branchId });
  return { status: 200, body: { session: session || null } };
};

module.exports = { getActiveAudit };
