'use strict';

const service = require('./unifiedTaxReadinessService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireBranchAuthority = (req) => {
  const requestedBranchId = Number(req.query?.branchId);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  const accountRole = normalizeRole(req.user?.role);
  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'TAX_READINESS_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== requestedBranchId) {
    const error = new Error('Cannot access another branch tax readiness workspace');
    error.code = 'TAX_READINESS_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return requestedBranchId;
};

const getWorkspace = async (req, res, next) => {
  try {
    const branchId = requireBranchAuthority(req);
    const data = await service.loadUnifiedTaxReadiness({
      branchId,
      taxPeriodId: req.params.taxPeriodId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getWorkspace, requireBranchAuthority });
