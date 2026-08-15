'use strict';

const handoffService = require('./taxClosingHandoffService');
const finalizationService = require('../finalization/taxClosingFinalizationService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireBranchAuthority = (req) => {
  const requestedBranchId = Number(req.query?.branchId);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);

  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'TAX_CLOSING_HANDOFF_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const elevated = ['SUPERADMIN', 'ADMIN'].includes(accountRole) || ['OWNER', 'MANAGER'].includes(employeeRole);
  if (!elevated) {
    const error = new Error('Tax closing handoff requires administrative authority');
    error.code = 'TAX_CLOSING_HANDOFF_ACCESS_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== requestedBranchId) {
    const error = new Error('Cannot access another branch tax closing handoff package');
    error.code = 'TAX_CLOSING_HANDOFF_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return requestedBranchId;
};

const actorEmployeeId = (req) => {
  const value = Number(req.user?.employeeId || req.user?.employeeProfileId || req.user?.id || 0);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const getBundle = async (req, res, next) => {
  try {
    const branchId = requireBranchAuthority(req);
    const data = await handoffService.loadTaxClosingHandoffBundle({
      branchId,
      taxPeriodId: req.params.taxPeriodId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const finalizeBundle = async (req, res, next) => {
  try {
    const branchId = requireBranchAuthority(req);
    const data = await finalizationService.finalizeCurrentPackage({
      branchId,
      taxPeriodId: req.params.taxPeriodId,
      finalizedById: actorEmployeeId(req),
      expectedSnapshotHash: req.body?.expectedSnapshotHash,
    });
    return res.status(data.replayed ? 200 : 201).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getBundle, finalizeBundle, requireBranchAuthority });
