'use strict';

const filingService = require('./inputTaxFilingService');
const overviewRepository = require('../overview/inputTaxOverviewRepository');
const overviewService = require('../overview/inputTaxOverviewService');
const {
  InputTaxCapability,
  assertInputTaxAuthority,
} = require('../../policies/inputTaxAccessPolicy');

const resolveAuthority = (req, source, capability) => assertInputTaxAuthority({
  user: req.user,
  requestedBranchId: source?.branchId,
  capability,
  accessForbiddenCode: 'INPUT_TAX_FILING_ACCESS_FORBIDDEN',
  branchForbiddenCode: 'INPUT_TAX_FILING_BRANCH_FORBIDDEN',
  actorRequiredCode: 'INPUT_TAX_FILING_ACTOR_REQUIRED',
  requireActor: true,
});

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
  return { document: row, reconciliation, eligibility: recent?.eligibility };
};

const selectDocument = handle(async (req) => {
  const authority = resolveAuthority(req, req.body, InputTaxCapability.SELECT_FOR_FILING);
  const taxDocumentId = Number(req.params.taxDocumentId);
  const batchAuthority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(batchAuthority.branchId) !== authority.branchId) {
    throw Object.assign(new Error('Filing batch does not belong to the requested branch'), {
      code: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
      statusCode: 403,
    });
  }
  const projection = await loadAuthoritativeDocument({ branchId: authority.branchId, taxDocumentId });
  return filingService.selectTaxDocumentForFiling({
    batchId: req.params.batchId,
    taxDocumentId,
    ...projection,
  });
}, 201);

const removeDocument = handle(async (req) => {
  const authority = resolveAuthority(req, req.body, InputTaxCapability.REMOVE_FROM_FILING);
  const batchAuthority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(batchAuthority.branchId) !== authority.branchId) {
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
  const authority = resolveAuthority(req, req.body, InputTaxCapability.FILE);
  const batchAuthority = await filingService.assertBatchPeriodMutable({ batchId: req.params.batchId });
  if (Number(batchAuthority.branchId) !== authority.branchId) {
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
