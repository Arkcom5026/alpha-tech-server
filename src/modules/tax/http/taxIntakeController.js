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

const getDocumentDetail = handle((req) => service.getDocumentDetail({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const getPrintableOutputTaxDocument = handle((req) => service.projectOutputTaxPrintableDocument({
  branchId: resolveBranchId(req, req.query),
  taxDocumentId: req.params.taxDocumentId,
}));

const refreshDraftRecipient = handle((req) => service.refreshDraftRecipient({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  actorEmployeeId: actorEmployeeId(req),
}));

const issueOutputTaxDocument = async (req, res, next) => {
  let branchId = null;
  try {
    branchId = resolveBranchId(req, req.body);
    const result = await service.issueOutputTaxDocument({
      branchId,
      taxDocumentId: req.params.taxDocumentId,
      taxInvoiceKind: req.body?.taxInvoiceKind,
      recipient: req.body?.recipient,
      actorEmployeeId: actorEmployeeId(req),
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status) || 500;
    console.warn('[tax.issue] rejected', {
      code: error?.code || 'TAX_ISSUE_FAILED',
      statusCode,
      branchId: Number(branchId) || Number(req.user?.branchId) || null,
      taxDocumentId: Number(req.params?.taxDocumentId) || null,
      taxInvoiceKind: String(req.body?.taxInvoiceKind || '').trim().toUpperCase() || null,
    });
    return next(error);
  }
};

const issueOutputTaxCreditNote = handle((req) => service.issueOutputTaxCreditNote({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  saleReturnId: req.body?.saleReturnId,
  actorEmployeeId: actorEmployeeId(req),
}), 201);

const issueOutputTaxCreditNoteForSaleReturn = handle((req) => service.issueOutputTaxCreditNoteForSaleReturn({
  branchId: resolveBranchId(req, req.body),
  saleReturnId: req.params.saleReturnId,
  actorEmployeeId: actorEmployeeId(req),
}), 201);

const transitionDocument = handle((req) => service.transitionTaxDocument({
  branchId: resolveBranchId(req, req.body),
  taxDocumentId: req.params.taxDocumentId,
  targetStatus: req.body?.targetStatus,
  reason: req.body?.reason,
  actorEmployeeId: actorEmployeeId(req),
}));

module.exports = Object.freeze({
  getDocumentDetail,
  getPrintableOutputTaxDocument,
  refreshDraftRecipient,
  issueOutputTaxDocument,
  issueOutputTaxCreditNote,
  issueOutputTaxCreditNoteForSaleReturn,
  listCandidates,
  listDocuments,
  registerCandidate,
  registerSaleCandidate,
  transitionDocument,
});
