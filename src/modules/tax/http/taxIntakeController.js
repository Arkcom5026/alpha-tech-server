'use strict';

const service = require('./taxIntakeService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveBranchId = (req, source) => {
  const requestedBranchId = Number(source?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );

  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && !['OWNER', 'MANAGER'].includes(employeeRole)) {
    throw Object.assign(new Error('Tax intake requires OWNER or MANAGER authority'), {
      code: 'TAX_INTAKE_ACCESS_FORBIDDEN',
      statusCode: 403,
    });
  }

  if (
    !['SUPERADMIN', 'ADMIN'].includes(accountRole) &&
    authorityBranchId > 0 &&
    requestedBranchId !== authorityBranchId
  ) {
    throw Object.assign(new Error('Cannot access another branch tax intake'), {
      code: 'TAX_INTAKE_BRANCH_FORBIDDEN',
      statusCode: 403,
    });
  }

  return requestedBranchId;
};

const actorEmployeeId = (req) => req.user?.employeeProfileId || req.user?.employeeId || null;

const handle = (operation, successStatus = 200) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(successStatus).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const registerCandidate = handle(
  (req) => service.registerTaxCandidate({
    ...req.body,
    branchId: resolveBranchId(req, req.body),
    actorEmployeeId: actorEmployeeId(req),
  }),
  201,
);

const registerSaleCandidate = handle(
  (req) => service.registerSaleTaxCandidate({
    branchId: resolveBranchId(req, req.body),
    saleId: req.params.saleId,
    actorEmployeeId: actorEmployeeId(req),
  }),
  201,
);

const listCandidates = handle((req) => service.listCandidates({
  ...req.query,
  branchId: resolveBranchId(req, req.query),
}));

const listDocuments = handle((req) => service.listDocuments({
  ...req.query,
  branchId: resolveBranchId(req, req.query),
}));

const getOutputTaxOverview = handle((req) => service.getOutputTaxOverview({
  branchId: resolveBranchId(req, req.query),
  year: req.query?.year,
  month: req.query?.month,
}));

const getOutputTaxPeriodReadiness = handle((req) => service.getOutputTaxPeriodReadiness({
  branchId: resolveBranchId(req, req.query),
  year: req.query?.year,
  month: req.query?.month,
}));

const getOutputTaxPeriodReport = handle((req) => service.getOutputTaxPeriodReport({
  branchId: resolveBranchId(req, req.query),
  year: req.query?.year,
  month: req.query?.month,
}));

const getDocumentDetail = handle((req) => service.getDocumentDetail({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getDocumentPrintProjection = handle((req) => service.getDocumentPrintProjection({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getDocumentTimelineProjection = handle((req) => service.getDocumentTimelineProjection({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getDocumentReplacementChainProjection = handle((req) => service.getDocumentReplacementChainProjection({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getDocumentOperationalReadinessProjection = handle((req) => service.getDocumentOperationalReadinessProjection({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getDocumentWorkspaceProjection = handle((req) => service.getDocumentWorkspaceProjection({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const issueDocument = handle((req) => service.issueTaxDocument({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  documentNumber: req.body?.documentNumber,
  issuedAt: req.body?.issuedAt,
  reason: req.body?.reason,
  actorEmployeeId: actorEmployeeId(req),
}));

const cancelDocument = handle((req) => service.cancelTaxDocument({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  reason: req.body?.reason,
  cancelledAt: req.body?.cancelledAt,
  actorEmployeeId: actorEmployeeId(req),
}));

const replaceDocument = handle(
  (req) => service.replaceCancelledTaxDocument({
    branchId: resolveBranchId(req, req.body),
    taxDocumentId: req.params.taxDocumentId,
    replacementDocumentNumber: req.body?.replacementDocumentNumber,
    replacementOccurredAt: req.body?.replacementOccurredAt,
    reason: req.body?.reason,
    actorEmployeeId: actorEmployeeId(req),
  }),
  201,
);

const transitionDocument = handle((req) => service.transitionTaxDocument({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  targetStatus: req.body?.targetStatus,
  reason: req.body?.reason,
  actorEmployeeId: actorEmployeeId(req),
}));

module.exports = Object.freeze({
  cancelDocument,
  getDocumentDetail,
  getDocumentOperationalReadinessProjection,
  getDocumentPrintProjection,
  getDocumentReplacementChainProjection,
  getDocumentTimelineProjection,
  getDocumentWorkspaceProjection,
  getOutputTaxOverview,
  getOutputTaxPeriodReadiness,
  getOutputTaxPeriodReport,
  issueDocument,
  listCandidates,
  listDocuments,
  registerCandidate,
  registerSaleCandidate,
  replaceDocument,
  transitionDocument,
});
