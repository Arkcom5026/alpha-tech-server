'use strict';

const { getInputTaxOverview } = require('./inputTaxOverviewService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();
const resolveBranchId = (req) => {
  const requestedBranchId = Number(req.query?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && !['OWNER', 'MANAGER'].includes(employeeRole)) {
    throw Object.assign(new Error('Input-tax overview requires OWNER or MANAGER authority'), {
      code: 'INPUT_TAX_OVERVIEW_ACCESS_FORBIDDEN', statusCode: 403,
    });
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole)
      && authorityBranchId > 0
      && requestedBranchId !== authorityBranchId) {
    throw Object.assign(new Error('Cannot access another branch input-tax overview'), {
      code: 'INPUT_TAX_OVERVIEW_BRANCH_FORBIDDEN', statusCode: 403,
    });
  }
  return requestedBranchId;
};

const get = async (req, res, next) => {
  try {
    const result = await getInputTaxOverview({ ...req.query, branchId: resolveBranchId(req) });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ get, resolveBranchId });
