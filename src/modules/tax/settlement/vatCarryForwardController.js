'use strict';

const service = require('./vatCarryForwardService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireAuthority = (req) => {
  const branchId = Number(req.query?.branchId ?? req.body?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'VAT_CARRY_FORWARD_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== branchId) {
    const error = new Error('Cannot manage another branch VAT carry-forward authority');
    error.code = 'VAT_CARRY_FORWARD_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return branchId;
};

const getAuthority = async (req, res, next) => {
  try {
    const data = await service.loadVatCarryForwardAuthority({
      branchId: requireAuthority(req),
      taxPeriodId: req.params.taxPeriodId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const confirmAuthority = async (req, res, next) => {
  try {
    const actorEmployeeId = Number(req.user?.employeeId || req.user?.employeeProfileId || req.user?.id || 0);
    const data = await service.confirmVatCarryForwardAuthority({
      branchId: requireAuthority(req),
      taxPeriodId: req.params.taxPeriodId,
      sourceType: req.body?.sourceType,
      amount: req.body?.amount,
      note: req.body?.note,
      actorEmployeeId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getAuthority, confirmAuthority });
