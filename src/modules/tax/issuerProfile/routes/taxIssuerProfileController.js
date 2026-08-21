'use strict';

const getService = require('../query/getTaxIssuerProfileService');
const updateService = require('../update/upsertTaxIssuerProfileService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveBranchId = (req, source) => {
  const requestedBranchId = Number(source?.branchId || 0);
  const accountRole = normalizeRole(req.user?.role);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );
  const platformAdmin = ['SUPERADMIN', 'ADMIN'].includes(accountRole);

  if (!platformAdmin) {
    if (!Number.isInteger(authorityBranchId) || authorityBranchId <= 0) {
      const error = new Error('Current branch authority is required');
      error.code = 'TAX_ISSUER_PROFILE_BRANCH_REQUIRED';
      error.statusCode = 403;
      throw error;
    }
    if (requestedBranchId && requestedBranchId !== authorityBranchId) {
      const error = new Error('Cannot access another store tax issuer profile');
      error.code = 'TAX_ISSUER_PROFILE_BRANCH_FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
    return authorityBranchId;
  }

  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    const error = new Error('branchId is required');
    error.code = 'TAX_ISSUER_PROFILE_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  return requestedBranchId;
};

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(result?.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getCurrentTaxIssuerProfile = handle((req) =>
  getService.getTaxIssuerProfile({
    branchId: resolveBranchId(req, req.query),
  }));

const upsertCurrentTaxIssuerProfile = handle((req) =>
  updateService.upsertTaxIssuerProfile({
    ...req.body,
    branchId: resolveBranchId(req, req.body),
  }));

module.exports = Object.freeze({
  getCurrentTaxIssuerProfile,
  upsertCurrentTaxIssuerProfile,
});
