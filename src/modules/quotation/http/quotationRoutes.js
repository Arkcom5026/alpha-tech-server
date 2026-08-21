'use strict';

const express = require('express');
const service = require('../quotationService');
const { ensureLatestRevision } = require('../quotationRevisionGuard');
const { listAcceptedReferenceCandidates } = require('../quotationReferenceCandidateService');
const { getQuotationDocumentLineage } = require('../../sales/lineage/saleQuotationReferenceService');
const {
  QUOTATION_CAPABILITY,
  allowQuotationCapabilities,
} = require('./quotationAuthorization');

const router = express.Router();

const context = (req) => ({
  branchId: Number(req.user?.branchId || req.user?.employeeBranchId || 0),
  employeeId: Number(req.user?.employeeId || req.user?.employeeProfileId || 0),
});

const requireEmployeeContext = (req, res, next) => {
  const authority = context(req);
  if (!authority.branchId || !authority.employeeId) {
    return res.status(403).json({
      ok: false,
      code: 'QUOTATION_EMPLOYEE_AUTHORITY_REQUIRED',
      message: 'Quotation workspace is available to authorized store employees only',
    });
  }
  return next();
};

const allowQuotationRead = allowQuotationCapabilities(QUOTATION_CAPABILITY.READ);
const allowQuotationManage = allowQuotationCapabilities(
  QUOTATION_CAPABILITY.READ,
  QUOTATION_CAPABILITY.MANAGE,
);
const allowQuotationIssue = allowQuotationCapabilities(
  QUOTATION_CAPABILITY.READ,
  QUOTATION_CAPABILITY.ISSUE,
);
const allowQuotationLifecycle = allowQuotationCapabilities(
  QUOTATION_CAPABILITY.READ,
  QUOTATION_CAPABILITY.LIFECYCLE,
);

router.use(requireEmployeeContext);

const handle = (operation, status = 200) => async (req, res, next) => {
  try {
    const data = await operation(req);
    return res.status(status).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const latestOnly = (operation) => async (req) => {
  const authority = context(req);
  await ensureLatestRevision({ quotationId: req.params.quotationId, branchId: authority.branchId });
  return operation(req, authority);
};

router.get('/', allowQuotationRead, handle((req) => service.list({ ...req.query, ...context(req) })));
router.get('/reference-candidates', allowQuotationRead, handle((req) => listAcceptedReferenceCandidates({
  branchId: context(req).branchId,
  customerId: req.query.customerId,
})));
router.post('/', allowQuotationManage, handle((req) => service.create({ ...req.body, ...context(req) }), 201));
router.get('/:quotationId', allowQuotationRead, handle((req) => service.detail({ quotationId: req.params.quotationId, ...context(req) })));
router.get('/:quotationId/revisions', allowQuotationRead, handle((req) => service.revisionHistory({ quotationId: req.params.quotationId, ...context(req) })));
router.get('/:quotationId/lineage', allowQuotationRead, handle((req) => getQuotationDocumentLineage({ quotationId: req.params.quotationId, branchId: context(req).branchId })));
router.post('/:quotationId/revisions', allowQuotationManage, handle((req) => service.createRevision({ ...req.body, quotationId: req.params.quotationId, ...context(req) }), 201));
router.put('/:quotationId', allowQuotationManage, handle((req) => service.updateDraft({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/items', allowQuotationManage, handle((req) => service.addLine({ ...req.body, quotationId: req.params.quotationId, ...context(req) }), 201));
router.put('/:quotationId/items/:lineId', allowQuotationManage, handle((req) => service.updateLine({ ...req.body, quotationId: req.params.quotationId, lineId: req.params.lineId, ...context(req) })));
router.delete('/:quotationId/items/:lineId', allowQuotationManage, handle((req) => service.removeLine({ quotationId: req.params.quotationId, lineId: req.params.lineId, ...context(req) })));
router.post('/:quotationId/issue', allowQuotationIssue, handle((req) => service.issue({ ...req.body, quotationId: req.params.quotationId, ...context(req) })));
router.post('/:quotationId/accept', allowQuotationLifecycle, handle(latestOnly((req, authority) => service.accept({ ...req.body, quotationId: req.params.quotationId, ...authority }))));
router.post('/:quotationId/reject', allowQuotationLifecycle, handle(latestOnly((req, authority) => service.reject({ ...req.body, quotationId: req.params.quotationId, ...authority }))));
router.post('/:quotationId/cancel', allowQuotationLifecycle, handle(latestOnly((req, authority) => service.cancel({ ...req.body, quotationId: req.params.quotationId, ...authority }))));

module.exports = router;
