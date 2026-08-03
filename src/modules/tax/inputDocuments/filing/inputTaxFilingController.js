'use strict';

const filingService = require('./inputTaxFilingService');
const overviewRepository = require('../overview/inputTaxOverviewRepository');
const overviewService = require('../overview/inputTaxOverviewService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveBranchId = (req, source) => {
  const requestedBranchId = Number(source?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );

  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && !['OWNER', 'MANAGER'].includes(employeeRole)) {
    throw Object.assign(new Error('Input tax filing requires OWNER or MANAGER authority'), {
      code: 'INPUT_TAX_FILING_ACCESS_FORBIDDEN',
      statusCode: 403,
    });
  }

  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), {
      code: 'TAX_BRANCH_REQUIRED',
      statusCode: 400,
    });
  }

  if (
    !['SUPERADMIN', 'ADMIN'].includes(accountRole)
    && authorityBranchId > 0
    && requestedBranchId !== authorityBranchId
  ) {
    throw Object.assign(new Error('Cannot access another branch input tax filing'), {
      code: 'INPUT_TAX_FILING_BRANCH_FORBIDDEN',
      statusCode: 403,
    });
  }

  return requestedBranchId;
};

const handle = (operation, successStatus = 200) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(successStatus).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const loadAuthoritativeDocument = async ({ branchId, taxDocumentId }) => {
  const now = new Date();
  const periodFrom = new Date(Date.UTC(now.getUTCFullYear() - 10, 0, 1));
  const periodToExclusive = new Date(Date.UTC(now.getUTCFullYear() + 2, 0, 1));
  const rows = await overviewRepository.listDocumentProjection({
    branchId,
    periodView: 'DOCUMENT',
    periodFrom,
    periodToExclusive,
  });
  const row = rows.find((item) => Number(item.id) === Number(taxDocumentId));
  if (!row) {
    throw Object.assign(new Error('Input tax document was not found in this branch'), {
      code: 'TAX_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  }
  const reconciliation = overviewService.projectDocumentReconciliation(row);
  const aggregate = overviewService.aggregateDocuments({
    branchId,
    periodView: 'DOCUMENT',
    periodFrom: periodFrom.toISOString().slice(0, 10),
    periodTo: new Date(periodToExclusive.getTime() - 86400000).toISOString().slice(0, 10),
    documents: [row],
    previousDocuments: [],
  });
  const recent = aggregate.recentDocuments[0];
  return {
    document: row,
    reconciliation,
    eligibility: recent?.eligibility,
  };
};

const selectDocument = handle(async (req) => {
  const branchId = resolveBranchId(req, req.body);
  const taxDocumentId = Number(req.params.taxDocumentId);
  const authority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(authority.branchId) !== branchId) {
    throw Object.assign(new Error('Filing batch does not belong to the requested branch'), {
      code: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
      statusCode: 403,
    });
  }
  const projection = await loadAuthoritativeDocument({ branchId, taxDocumentId });
  return filingService.selectTaxDocumentForFiling({
    batchId: req.params.batchId,
    taxDocumentId,
    ...projection,
  });
}, 201);

const removeDocument = handle(async (req) => {
  const branchId = resolveBranchId(req, req.body);
  const authority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(authority.branchId) !== branchId) {
    throw Object.assign(new Error('Filing batch does not belong to the requested branch'), {
      code: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
      statusCode: 403,
    });
  }
  return filingService.removeTaxDocumentFromFiling({
    batchId: req.params.batchId,
    taxDocumentId: req.params.taxDocumentId,
    removedReason: req.body?.reason || null,
  });
});

const markBatchFiled = handle(async (req) => {
  const branchId = resolveBranchId(req, req.body);
  const authority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(authority.branchId) !== branchId) {
    throw Object.assign(new Error('Filing batch does not belong to the requested branch'), {
      code: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
      statusCode: 403,
    });
  }
  return filingService.markInputTaxBatchFiled({
    batchId: req.params.batchId,
    filedAt: req.body?.filedAt ? new Date(req.body.filedAt) : new Date(),
  });
});

module.exports = Object.freeze({ markBatchFiled, removeDocument, selectDocument });
