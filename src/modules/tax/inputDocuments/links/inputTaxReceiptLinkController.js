'use strict';

const service = require('./inputTaxReceiptLinkService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();
const actorEmployeeId = (req) => req.user?.employeeProfileId || req.user?.employeeId || null;
const branchId = (req) => {
  const requestedBranchId = Number(req.body?.branchId ?? req.query?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && !['OWNER', 'MANAGER'].includes(employeeRole)) {
    throw Object.assign(new Error('Input-tax receipt links require OWNER or MANAGER authority'), {
      code: 'INPUT_TAX_LINK_ACCESS_FORBIDDEN', statusCode: 403,
    });
  }
  if (
    !['SUPERADMIN', 'ADMIN'].includes(accountRole)
    && authorityBranchId > 0
    && requestedBranchId !== authorityBranchId
  ) {
    throw Object.assign(new Error('Cannot change another branch input-tax receipt links'), {
      code: 'INPUT_TAX_LINK_BRANCH_FORBIDDEN', statusCode: 403,
    });
  }
  return requestedBranchId;
};
const handle = (operation, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json({ ok: true, data: await operation(req) });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  attach: handle((req) => service.attachReceiptLinks({
    branchId: branchId(req),
    taxDocumentId: req.params.taxDocumentId,
    commandKey: req.body?.commandKey,
    receiptReferences: req.body?.receiptReferences,
    actorEmployeeId: actorEmployeeId(req),
  }), 201),
  cancel: handle((req) => service.cancelReceiptLink({
    branchId: branchId(req),
    taxDocumentId: req.params.taxDocumentId,
    linkId: req.params.linkId,
    reason: req.body?.reason,
    actorEmployeeId: actorEmployeeId(req),
  })),
  list: handle((req) => service.listReceiptLinks({
    branchId: branchId(req),
    taxDocumentId: req.params.taxDocumentId,
  })),
  reallocate: handle((req) => service.reallocateReceiptLink({
    branchId: branchId(req),
    taxDocumentId: req.params.taxDocumentId,
    linkId: req.params.linkId,
    allocation: req.body,
    reason: req.body?.reason,
    actorEmployeeId: actorEmployeeId(req),
  })),
});
