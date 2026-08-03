'use strict';

const service = require('./inputTaxDecisionService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveBranchId = (req, source) => {
  const requestedBranchId = Number(source?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );

  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && !['OWNER', 'MANAGER'].includes(employeeRole)) {
    throw Object.assign(new Error('Input tax decision requires OWNER or MANAGER authority'), {
      code: 'INPUT_TAX_DECISION_ACCESS_FORBIDDEN',
      statusCode: 403,
    });
  }
  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    throw Object.assign(new Error('branchId is required'), {
      code: 'TAX_BRANCH_REQUIRED',
      statusCode: 400,
    });
  }
  if (
    !['SUPERADMIN', 'ADMIN'].includes(accountRole)
    && authorityBranchId > 0
    && requestedBranchId !== authorityBranchId
  ) {
    throw Object.assign(new Error('Cannot access another branch input tax decisions'), {
      code: 'INPUT_TAX_DECISION_BRANCH_FORBIDDEN',
      statusCode: 403,
    });
  }
  return requestedBranchId;
};

const actorEmployeeId = (req) => req.user?.employeeProfileId || req.user?.employeeId || null;

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const decideDuplicate = handle((req) => service.decideDuplicate({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  decision: req.body?.decision,
  reason: req.body?.reason,
  evidence: req.body?.evidence || null,
  actorEmployeeId: actorEmployeeId(req),
}));

const linkReplacement = handle((req) => service.linkReplacement({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  replacesTaxDocumentId: req.body?.replacesTaxDocumentId,
  reason: req.body?.reason,
  evidence: req.body?.evidence || null,
  actorEmployeeId: actorEmployeeId(req),
}));

module.exports = Object.freeze({ decideDuplicate, linkReplacement });
