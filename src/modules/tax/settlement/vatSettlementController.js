'use strict';

const service = require('./vatSettlementService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireBranchAuthority = (req) => {
  const requestedBranchId = Number(req.query?.branchId);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);

  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'VAT_SETTLEMENT_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const elevated = ['SUPERADMIN', 'ADMIN'].includes(accountRole) || ['OWNER', 'MANAGER'].includes(employeeRole);
  if (!elevated) {
    const error = new Error('VAT settlement preparation requires administrative authority');
    error.code = 'VAT_SETTLEMENT_ACCESS_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== requestedBranchId) {
    const error = new Error('Cannot access another branch VAT settlement');
    error.code = 'VAT_SETTLEMENT_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return requestedBranchId;
};

const getPreparation = async (req, res, next) => {
  try {
    const data = await service.loadVatSettlementPreparation({
      branchId: requireBranchAuthority(req),
      taxPeriodId: req.params.taxPeriodId,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getPreparation });
