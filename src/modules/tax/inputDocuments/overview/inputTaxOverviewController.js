'use strict';

const { getInputTaxOverview } = require('./inputTaxOverviewService');

const MAX_OVERVIEW_RANGE_DAYS = 366;
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

const assertBoundedPeriod = (query = {}) => {
  const fromText = String(query.periodFrom || '').trim();
  const toText = String(query.periodTo || '').trim();
  if (!fromText || !toText) return;

  const from = new Date(`${fromText}T00:00:00.000Z`);
  const to = new Date(`${toText}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return;

  const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (rangeDays > MAX_OVERVIEW_RANGE_DAYS) {
    throw Object.assign(new Error(`Input-tax overview period must not exceed ${MAX_OVERVIEW_RANGE_DAYS} days`), {
      code: 'INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE',
      statusCode: 413,
      details: { maxRangeDays: MAX_OVERVIEW_RANGE_DAYS, rangeDays },
    });
  }
};

const get = async (req, res, next) => {
  try {
    assertBoundedPeriod(req.query);
    const result = await getInputTaxOverview({ ...req.query, branchId: resolveBranchId(req) });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  MAX_OVERVIEW_RANGE_DAYS,
  assertBoundedPeriod,
  get,
  resolveBranchId,
});
