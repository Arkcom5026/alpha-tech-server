'use strict';

const { prisma } = require('../../../../../lib/prisma');
const workspaceRepository = require('./inputTaxFilingWorkspaceRepository');
const overviewRepository = require('../overview/inputTaxOverviewRepository');
const overviewService = require('../overview/inputTaxOverviewService');
const { projectInputTaxEligibility } = require('../eligibility/inputTaxEligibilityService');
const { projectInputTaxDuplicates } = require('../duplicates/inputTaxDuplicateService');
const { projectInputTaxReplacementChains } = require('../replacements/inputTaxReplacementService');
const { TRANSITIONS } = require('../../documents/lifecycle/taxDocumentLifecycle');

const PERIOD_MUTATION_BLOCKED_STATUSES = new Set(['CLOSED', 'LOCKED', 'SUBMITTED']);
const INPUT_TAX_PENDING_AUTHORITY_STATUSES = new Set(['DRAFT', 'REGISTERED', 'UNDER_REVIEW', 'APPROVED']);
const INPUT_TAX_VISIBLE_STATUSES = new Set(['DRAFT', 'REGISTERED', 'UNDER_REVIEW', 'REJECTED', 'APPROVED']);
const APPROVAL_SEQUENCE = Object.freeze(['REGISTERED', 'UNDER_REVIEW', 'APPROVED']);

const fail = (code, message, statusCode = 400, details) => {
  throw Object.assign(new Error(message), { code, statusCode, ...(details ? { details } : {}) });
};

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail('INPUT_TAX_FILING_INPUT_INVALID', `${fieldName} must be a positive integer`, 400, { fieldName });
  }
  return parsed;
};

const requirePeriodId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) fail('INPUT_TAX_FILING_PERIOD_REQUIRED', 'taxPeriodId is required');
  return normalized;
};

const periodParts = (period) => {
  const date = new Date(period.startDate);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
};

const periodToExclusive = (period) => {
  const end = new Date(period.endDate);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
};

const nextApprovalTarget = (status) => {
  const allowed = TRANSITIONS[String(status || '').toUpperCase()] || [];
  return APPROVAL_SEQUENCE.find((target) => allowed.includes(target)) || null;
};

const prepareInputTaxFilingBatch = async ({ branchId, taxPeriodId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedPeriodId = requirePeriodId(taxPeriodId);
  const normalizedActorId = positiveInt(actorEmployeeId, 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const period = await workspaceRepository.findPeriod(
      { branchId: normalizedBranchId, taxPeriodId: normalizedPeriodId },
      tx,
      { forUpdate: true },
    );
    if (!period) fail('INPUT_TAX_FILING_PERIOD_NOT_FOUND', 'Tax period not found', 404);
    if (PERIOD_MUTATION_BLOCKED_STATUSES.has(String(period.status || '').toUpperCase())) {
      fail('INPUT_TAX_PERIOD_MUTATION_BLOCKED', 'Input tax filing preparation is blocked in this period state', 409, {
        taxPeriodId: normalizedPeriodId,
        taxPeriodStatus: period.status,
      });
    }

    const { year, month } = periodParts(period);
    await workspaceRepository.acquirePeriodPreparationLock({ branchId: normalizedBranchId, year, month }, tx);

    const existing = await workspaceRepository.findLatestActiveBatch({
      branchId: normalizedBranchId,
      year,
      month,
    }, tx);
    if (existing) {
      return Object.freeze({
        authority: 'INPUT_TAX_FILING_BATCH',
        replayed: true,
        batch: existing,
        period,
      });
    }

    const batch = await workspaceRepository.createDraftBatch({
      branchId: normalizedBranchId,
      year,
      month,
      createdById: normalizedActorId,
    }, tx);
    return Object.freeze({
      authority: 'INPUT_TAX_FILING_BATCH',
      replayed: false,
      batch,
      period,
    });
  });
};

const getInputTaxFilingWorkspace = async ({ branchId, taxPeriodId }) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedPeriodId = requirePeriodId(taxPeriodId);
  const period = await workspaceRepository.findPeriod({
    branchId: normalizedBranchId,
    taxPeriodId: normalizedPeriodId,
  });
  if (!period) fail('INPUT_TAX_FILING_PERIOD_NOT_FOUND', 'Tax period not found', 404);

  const { year, month } = periodParts(period);
  const [batch, authorities, overviewRows] = await Promise.all([
    workspaceRepository.findLatestActiveBatch({ branchId: normalizedBranchId, year, month }),
    workspaceRepository.listPeriodInputVatAuthorities({
      branchId: normalizedBranchId,
      taxPeriodId: normalizedPeriodId,
      startDate: period.startDate,
      endDate: period.endDate,
    }),
    overviewRepository.listDocumentProjection({
      branchId: normalizedBranchId,
      periodView: 'DOCUMENT',
      periodFrom: new Date(period.startDate),
      periodToExclusive: periodToExclusive(period),
    }),
  ]);

  const items = batch ? await workspaceRepository.listBatchItems({ batchId: batch.id }) : [];
  const activeItems = items.filter((item) => ['SELECTED', 'FILED'].includes(String(item.status || '').toUpperCase()));
  const itemByDocumentId = new Map(activeItems.map((item) => [Number(item.taxDocumentId), item]));
  const authorityByDocumentId = new Map(authorities.map((item) => [Number(item.taxDocumentId), item]));
  const duplicateById = projectInputTaxDuplicates(overviewRows);
  const replacementById = projectInputTaxReplacementChains(overviewRows);
  const periodMutable = !PERIOD_MUTATION_BLOCKED_STATUSES.has(String(period.status || '').toUpperCase());

  const documents = overviewRows
    .filter((row) => {
      const hasAuthority = authorityByDocumentId.has(Number(row.id));
      const status = String(row.status || '').toUpperCase();
      return hasAuthority || (
        row.documentType === 'INPUT_TAX_INVOICE'
        && INPUT_TAX_VISIBLE_STATUSES.has(status)
      );
    })
    .map((row) => {
      const vatAuthority = authorityByDocumentId.get(Number(row.id)) || null;
      const status = String(row.status || '').toUpperCase();
      const reconciliation = overviewService.projectDocumentReconciliation(row);
      const duplicate = duplicateById.get(row.id);
      const replacement = replacementById.get(row.id);
      const eligibility = projectInputTaxEligibility({ document: row, reconciliation, duplicate, replacement });
      const filingItem = itemByDocumentId.get(Number(row.id)) || null;
      const hasInputVatAuthority = Boolean(vatAuthority);
      const requiresInputVatApproval = Boolean(
        !hasInputVatAuthority
        && row.documentType === 'INPUT_TAX_INVOICE'
        && INPUT_TAX_PENDING_AUTHORITY_STATUSES.has(status)
      );
      const nextLifecycleTarget = hasInputVatAuthority ? null : nextApprovalTarget(status);
      const lifecycleBlockedByReconciliation = nextLifecycleTarget === 'APPROVED' && !reconciliation.canApprove;
      const canAdvanceLifecycle = Boolean(
        periodMutable
        && nextLifecycleTarget
        && !lifecycleBlockedByReconciliation
      );
      const canSelectForFiling = Boolean(
        hasInputVatAuthority
        && batch
        && String(batch.status).toUpperCase() === 'DRAFT'
        && !filingItem
        && eligibility.canSelectForFiling
      );
      const canRemoveFromFiling = Boolean(
        batch
        && String(batch.status).toUpperCase() === 'DRAFT'
        && filingItem
        && String(filingItem.status).toUpperCase() === 'SELECTED'
      );

      return Object.freeze({
        taxDocumentId: Number(row.id),
        inputVatRecordId: vatAuthority?.inputVatRecordId || null,
        hasInputVatAuthority,
        requiresInputVatApproval,
        documentStatus: status,
        nextLifecycleTarget,
        canAdvanceLifecycle,
        lifecycleBlockedReason: lifecycleBlockedByReconciliation ? 'RECONCILIATION_REQUIRED' : null,
        documentNumber: vatAuthority?.documentNumber || row.documentNumber,
        documentDate: vatAuthority?.documentDate || row.issuedAt || row.occurredAt,
        supplierName: vatAuthority?.supplierName || row.snapshot?.supplierName || row.snapshot?.issuerName || row.snapshot?.counterpartyName || 'ไม่ระบุผู้จำหน่าย',
        supplierTaxId: row.counterpartyTaxId || row.snapshot?.supplierTaxId || row.snapshot?.issuerTaxId || null,
        subtotalAmount: vatAuthority?.subtotalAmount ?? Number(row.subtotalAmount || 0),
        vatAmount: vatAuthority?.taxAmount ?? Number(row.vatAmount ?? row.taxAmount ?? 0),
        totalAmount: vatAuthority?.totalAmount ?? Number(row.totalAmount || 0),
        currency: vatAuthority?.currency || row.currency || 'THB',
        reconciliation,
        eligibility,
        filingItem,
        canSelectForFiling,
        canRemoveFromFiling,
      });
    });

  const authorityDocuments = documents.filter((item) => item.hasInputVatAuthority);
  const pendingApprovalCount = documents.filter((item) => item.requiresInputVatApproval).length;
  const selectedCount = authorityDocuments.filter((item) => ['SELECTED', 'FILED'].includes(String(item.filingItem?.status || '').toUpperCase())).length;
  const filedCount = authorityDocuments.filter((item) => String(item.filingItem?.status || '').toUpperCase() === 'FILED').length;
  const coversAllDocuments = Boolean(batch) && selectedCount === authorityDocuments.length;

  return Object.freeze({
    authority: 'INPUT_TAX_FILING_WORKSPACE',
    branchId: normalizedBranchId,
    period,
    batch,
    summary: Object.freeze({
      visibleDocumentCount: documents.length,
      authorityDocumentCount: authorityDocuments.length,
      pendingApprovalCount,
      selectedDocumentCount: selectedCount,
      filedDocumentCount: filedCount,
      remainingDocumentCount: Math.max(authorityDocuments.length - selectedCount, 0),
      filingPrepared: Boolean(batch),
      filingCoversAllDocuments: coversAllDocuments,
      readyForTaxClosing: Boolean(batch) && pendingApprovalCount === 0 && coversAllDocuments,
    }),
    documents,
  });
};

module.exports = Object.freeze({
  getInputTaxFilingWorkspace,
  prepareInputTaxFilingBatch,
});
