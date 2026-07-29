'use strict';

const repository = require('./inputTaxOverviewRepository');
const { PERIOD_VIEWS, createEmptyOverview } = require('./inputTaxOverviewContract');
const {
  MONEY_TOLERANCE,
  createReconciliationProjection,
} = require('../reconciliation/inputTaxReconciliationContract');
const { projectInputTaxEligibility } = require('../eligibility/inputTaxEligibilityService');
const { projectInputTaxDuplicates } = require('../duplicates/inputTaxDuplicateService');
const { projectInputTaxReplacementChains } = require('../replacements/inputTaxReplacementService');

const ACTIVE_STATUSES = new Set(['DRAFT', 'ISSUED', 'APPROVED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'VOIDED', 'REPLACED']);

const positiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const parseDateOnly = (value, fieldName) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw Object.assign(new Error(`${fieldName} must use YYYY-MM-DD`), {
      code: 'INPUT_TAX_OVERVIEW_PERIOD_INVALID', statusCode: 400, details: { fieldName },
    });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${fieldName} is invalid`), {
      code: 'INPUT_TAX_OVERVIEW_PERIOD_INVALID', statusCode: 400, details: { fieldName },
    });
  }
  return date;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const amount = (value) => Number(value || 0);
const money = (value) => Number(value || 0).toFixed(2);
const normalizeText = (value) => String(value || '').trim();
const supplierName = (document) => normalizeText(
  document.snapshot?.supplierName
  || document.snapshot?.issuerName
  || document.snapshot?.counterpartyName
  || 'ไม่ระบุ Supplier',
);
const supplierTaxId = (document) => normalizeText(
  document.counterpartyTaxId
  || document.snapshot?.supplierTaxId
  || document.snapshot?.issuerTaxId
  || document.snapshot?.counterpartyTaxId,
);
const isCancelled = (document) => CANCELLED_STATUSES.has(String(document.status || '').toUpperCase());
const isActive = (document) => ACTIVE_STATUSES.has(String(document.status || '').toUpperCase()) || !isCancelled(document);
const variance = (documentValue, allocatedValue) => amount(documentValue) - amount(allocatedValue);
const withinTolerance = (value) => Math.abs(amount(value)) <= amount(MONEY_TOLERANCE);

const projectDocumentReconciliation = (document) => {
  const documentAmount = Object.freeze({
    subtotalAmount: money(document.subtotalAmount),
    vatAmount: money(document.vatAmount),
    totalAmount: money(document.totalAmount),
  });
  const allocatedAmount = Object.freeze({
    subtotalAmount: money(document.allocatedSubtotal),
    vatAmount: money(document.allocatedVatAmount),
    totalAmount: money(document.allocatedTotalAmount),
  });
  const amountVariance = Object.freeze({
    subtotalAmount: money(variance(document.subtotalAmount, document.allocatedSubtotal)),
    vatAmount: money(variance(document.vatAmount, document.allocatedVatAmount)),
    totalAmount: money(variance(document.totalAmount, document.allocatedTotalAmount)),
  });
  const hasLinks = document.linkedReceiptCount > 0;
  const matched = hasLinks
    && withinTolerance(amountVariance.subtotalAmount)
    && withinTolerance(amountVariance.vatAmount)
    && withinTolerance(amountVariance.totalAmount);
  const overAllocated = hasLinks && [
    amountVariance.subtotalAmount,
    amountVariance.vatAmount,
    amountVariance.totalAmount,
  ].some((value) => amount(value) < -amount(MONEY_TOLERANCE));
  const status = !hasLinks
    ? 'UNLINKED'
    : (matched ? 'RECONCILED' : (overAllocated ? 'OVER_ALLOCATED' : 'PARTIALLY_RECONCILED'));
  const qualityCodes = [
    !hasLinks ? 'UNLINKED_DOCUMENT' : null,
    hasLinks && !matched ? 'ALLOCATION_MISMATCH' : null,
    overAllocated ? 'OVER_ALLOCATED' : null,
    !supplierTaxId(document) ? 'MISSING_SUPPLIER_TAX_ID' : null,
    !normalizeText(document.documentNumber) ? 'MISSING_INVOICE_NUMBER' : null,
  ].filter(Boolean);
  return createReconciliationProjection({
    status,
    receiptCount: document.linkedReceiptCount,
    documentAmount,
    allocatedAmount,
    variance: amountVariance,
    qualityCodes,
  });
};

const percentChange = (current, previous) => {
  if (amount(previous) === 0) return { value: null, reason: 'NO_COMPARABLE_BASE' };
  return { value: (((amount(current) - amount(previous)) / amount(previous)) * 100).toFixed(4), reason: null };
};

const decorateDocuments = (documents) => {
  const duplicateById = projectInputTaxDuplicates(documents);
  const replacementById = projectInputTaxReplacementChains(documents);
  return documents.map((row) => {
    const reconciliation = projectDocumentReconciliation(row);
    const duplicate = duplicateById.get(row.id);
    const replacement = replacementById.get(row.id);
    const eligibility = projectInputTaxEligibility({
      document: row,
      reconciliation,
      duplicate,
      replacement,
    });
    return { ...row, reconciliation, duplicate, replacement, eligibility };
  });
};

const aggregateDocuments = ({ branchId, periodView, periodFrom, periodTo, documents, previousDocuments }) => {
  const result = createEmptyOverview({ branchId, periodView, periodFrom, periodTo });
  const activeDocuments = decorateDocuments(documents.filter(isActive));
  const cancelledDocuments = documents.filter(isCancelled);
  const previousActive = decorateDocuments(previousDocuments.filter(isActive));
  const sum = (rows, field) => rows.reduce((total, row) => total + amount(row[field]), 0);
  const sumEligibility = (rows, field) => rows.reduce((total, row) => total + amount(row.eligibility[field]), 0);
  const reconciled = activeDocuments.filter((row) => row.reconciliation.status === 'RECONCILED');
  const unlinked = activeDocuments.filter((row) => row.reconciliation.status === 'UNLINKED');
  const partiallyReconciled = activeDocuments.filter((row) => row.reconciliation.status === 'PARTIALLY_RECONCILED');
  const overAllocated = activeDocuments.filter((row) => row.reconciliation.status === 'OVER_ALLOCATED');
  const mismatched = [...partiallyReconciled, ...overAllocated];
  const eligible = activeDocuments.filter((row) => ['ELIGIBLE', 'PARTIALLY_ELIGIBLE'].includes(row.eligibility.status));
  const deferred = activeDocuments.filter((row) => row.eligibility.status === 'DEFERRED');
  const selected = activeDocuments.filter((row) => row.eligibility.status === 'SELECTED_FOR_FILING');
  const filed = activeDocuments.filter((row) => row.eligibility.status === 'FILED');
  const blocked = activeDocuments.filter((row) => !row.eligibility.canSelectForFiling
    && !['SELECTED_FOR_FILING', 'FILED', 'DEFERRED'].includes(row.eligibility.status));

  result.headline.documentCount = documents.length;
  result.headline.activeDocumentCount = activeDocuments.length;
  result.headline.cancelledDocumentCount = cancelledDocuments.length;
  result.headline.subtotalAmount = money(sum(activeDocuments, 'subtotalAmount'));
  result.headline.vatAmount = money(sum(activeDocuments, 'vatAmount'));
  result.headline.totalAmount = money(sum(activeDocuments, 'totalAmount'));
  result.headline.reconciledVatAmount = money(sum(reconciled, 'vatAmount'));
  result.headline.claimableVatAmount = money(sumEligibility(eligible, 'eligibleVatAmount'));
  result.headline.selectedVatAmount = money(sumEligibility(selected, 'eligibleVatAmount'));
  result.headline.filedVatAmount = money(sumEligibility(filed, 'eligibleVatAmount'));
  result.headline.deferredVatAmount = money(sumEligibility(deferred, 'eligibleVatAmount'));
  result.headline.blockedVatAmount = money(sumEligibility(blocked, 'grossVatAmount'));

  const previousVat = sum(previousActive, 'vatAmount');
  const previousClaimableVat = sumEligibility(
    previousActive.filter((row) => ['ELIGIBLE', 'PARTIALLY_ELIGIBLE'].includes(row.eligibility.status)),
    'eligibleVatAmount',
  );
  const vatComparison = percentChange(result.headline.vatAmount, previousVat);
  const claimComparison = percentChange(result.headline.claimableVatAmount, previousClaimableVat);
  result.comparison.previousDocumentVatAmount = money(previousVat);
  result.comparison.documentVatAmountChange = money(amount(result.headline.vatAmount) - previousVat);
  result.comparison.documentVatAmountChangePercent = vatComparison.value;
  result.comparison.previousClaimableVatAmount = money(previousClaimableVat);
  result.comparison.claimableVatAmountChange = money(amount(result.headline.claimableVatAmount) - previousClaimableVat);
  result.comparison.claimableVatAmountChangePercent = claimComparison.value;
  result.comparison.percentChangeReason = vatComparison.reason || claimComparison.reason;

  result.reconciliation.unlinkedDocumentCount = unlinked.length;
  result.reconciliation.fullyLinkedDocumentCount = reconciled.length;
  result.reconciliation.partiallyLinkedDocumentCount = mismatched.length;
  result.reconciliation.allocationMatchedDocumentCount = reconciled.length;
  result.reconciliation.allocationMismatchDocumentCount = mismatched.length;
  result.reconciliation.allocationDifferenceAmount = money(mismatched.reduce(
    (total, row) => total + Math.abs(amount(row.reconciliation.variance.totalAmount)), 0,
  ));
  result.reconciliation.unreconciledVatAmount = money(sum([...unlinked, ...mismatched], 'vatAmount'));

  const missingTaxId = activeDocuments.filter((row) => row.reconciliation.qualityCodes.includes('MISSING_SUPPLIER_TAX_ID'));
  const missingNumber = activeDocuments.filter((row) => row.reconciliation.qualityCodes.includes('MISSING_INVOICE_NUMBER'));
  const duplicateRisk = activeDocuments.filter((row) => ['POSSIBLE_DUPLICATE', 'HIGH_CONFIDENCE_DUPLICATE', 'CONFIRMED_DUPLICATE'].includes(row.duplicate.status));
  const replacementDocuments = activeDocuments.filter((row) => row.replacement.status !== 'NONE');
  const attentionDocuments = activeDocuments.filter((row) => row.reconciliation.qualityCodes.length > 0
    || row.eligibility.reasonCodes.length > 0
    || row.duplicate.status !== 'NONE'
    || row.replacement.status !== 'NONE');
  result.quality.missingSupplierTaxIdCount = missingTaxId.length;
  result.quality.missingInvoiceNumberCount = missingNumber.length;
  result.quality.duplicateInvoiceRiskCount = duplicateRisk.length;
  result.quality.replacementDocumentCount = replacementDocuments.length;
  result.quality.attentionItemCount = attentionDocuments.length;
  result.quality.hasAttentionItems = attentionDocuments.length > 0;

  result.filingReadiness.readyDocumentCount = eligible.length;
  result.filingReadiness.blockedDocumentCount = blocked.length;
  result.filingReadiness.selectedDocumentCount = selected.length;
  result.filingReadiness.filedDocumentCount = filed.length;
  result.filingReadiness.deferredDocumentCount = deferred.length;
  result.filingReadiness.readyVatAmount = money(sumEligibility(eligible, 'eligibleVatAmount'));
  result.filingReadiness.blockedVatAmount = money(sumEligibility(blocked, 'grossVatAmount'));
  result.filingReadiness.selectedVatAmount = money(sumEligibility(selected, 'eligibleVatAmount'));
  result.filingReadiness.filedVatAmount = money(sumEligibility(filed, 'eligibleVatAmount'));
  result.filingReadiness.deferredVatAmount = money(sumEligibility(deferred, 'eligibleVatAmount'));
  const blockerCodes = ['UNLINKED_DOCUMENT', 'ALLOCATION_MISMATCH', 'OVER_ALLOCATED'];
  const reconciliationBlockers = blockerCodes.map((code) => {
    const rows = activeDocuments.filter((row) => row.reconciliation.qualityCodes.includes(code));
    return { code, documentCount: rows.length, vatAmount: money(sum(rows, 'vatAmount')) };
  });
  const eligibilityCodes = [...new Set(blocked.flatMap((row) => row.eligibility.reasonCodes))];
  const eligibilityBlockers = eligibilityCodes.map((code) => {
    const rows = blocked.filter((row) => row.eligibility.reasonCodes.includes(code));
    return { code, documentCount: rows.length, vatAmount: money(sumEligibility(rows, 'grossVatAmount')) };
  });
  result.filingReadiness.blockerSummary = [...reconciliationBlockers, ...eligibilityBlockers]
    .filter((item) => item.documentCount > 0)
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.code === item.code) === index);

  const group = (keyFn) => {
    const map = new Map();
    activeDocuments.forEach((row) => {
      const key = keyFn(row);
      const current = map.get(key) || { key, documentCount: 0, subtotalAmount: 0, vatAmount: 0, totalAmount: 0 };
      current.documentCount += 1;
      current.subtotalAmount += amount(row.subtotalAmount);
      current.vatAmount += amount(row.vatAmount);
      current.totalAmount += amount(row.totalAmount);
      map.set(key, current);
    });
    return [...map.values()].map((item) => ({
      ...item,
      subtotalAmount: money(item.subtotalAmount),
      vatAmount: money(item.vatAmount),
      totalAmount: money(item.totalAmount),
    }));
  };

  result.byDocumentType = group((row) => row.documentType || 'UNKNOWN');
  result.bySourceType = group((row) => row.sourceTypes.length ? row.sourceTypes.join('+') : 'UNLINKED');
  result.bySupplier = group((row) => supplierName(row)).sort((a, b) => amount(b.vatAmount) - amount(a.vatAmount)).slice(0, 20);
  const activeById = new Map(activeDocuments.map((row) => [row.id, row]));
  const allDuplicateById = projectInputTaxDuplicates(documents);
  const allReplacementById = projectInputTaxReplacementChains(documents);
  result.recentDocuments = documents.slice(0, 10).map((row) => {
    const activeRow = activeById.get(row.id);
    const reconciliation = activeRow ? activeRow.reconciliation : projectDocumentReconciliation(row);
    const duplicate = activeRow ? activeRow.duplicate : allDuplicateById.get(row.id);
    const replacement = activeRow ? activeRow.replacement : allReplacementById.get(row.id);
    const eligibility = activeRow
      ? activeRow.eligibility
      : projectInputTaxEligibility({ document: row, reconciliation, duplicate, replacement });
    const duplicateReason = duplicate && duplicate.status !== 'NONE' ? 'DUPLICATE_DOCUMENT_RISK' : null;
    const replacementReason = replacement && replacement.status !== 'NONE'
      ? (replacement.status === 'CHAIN_CONFLICT' ? 'MANUAL_REVIEW_REQUIRED' : 'REPLACED_DOCUMENT')
      : null;
    return {
      taxDocumentId: row.id,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      documentDate: row.issuedAt,
      receivedAt: row.occurredAt,
      periodView,
      periodDate: row.periodDate,
      supplier: { name: supplierName(row), taxId: supplierTaxId(row) || null },
      amounts: {
        subtotalAmount: row.subtotalAmount,
        vatAmount: row.vatAmount,
        totalAmount: row.totalAmount,
      },
      sourceTypes: row.sourceTypes,
      linkedReceiptCount: row.linkedReceiptCount,
      reconciliationStatus: reconciliation.status,
      reconciliation,
      eligibilityStatus: eligibility.status,
      eligibility,
      duplicateStatus: duplicate?.status || 'NONE',
      duplicate,
      replacementStatus: replacement?.status || 'NONE',
      replacement,
      filingStatus: ['SELECTED_FOR_FILING', 'FILED'].includes(eligibility.status)
        ? eligibility.status
        : 'NOT_SELECTED',
      attentionReasons: [...new Set([
        ...reconciliation.qualityCodes,
        ...eligibility.reasonCodes,
        duplicateReason,
        replacementReason,
      ].filter(Boolean))],
      updatedAt: row.updatedAt,
    };
  });
  return result;
};

const getInputTaxOverview = async (input = {}) => {
  const branchId = positiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const periodView = String(input.periodView || 'DOCUMENT').trim().toUpperCase();
  if (!PERIOD_VIEWS.includes(periodView)) {
    throw Object.assign(new Error(`periodView must be ${PERIOD_VIEWS.join(', ')}`), {
      code: 'INPUT_TAX_OVERVIEW_PERIOD_VIEW_INVALID', statusCode: 400,
    });
  }
  const periodFromDate = parseDateOnly(input.periodFrom, 'periodFrom');
  const periodToDate = parseDateOnly(input.periodTo, 'periodTo');
  if (periodToDate < periodFromDate) {
    throw Object.assign(new Error('periodTo must not be earlier than periodFrom'), {
      code: 'INPUT_TAX_OVERVIEW_PERIOD_RANGE_INVALID', statusCode: 400,
    });
  }
  const periodToExclusive = addDays(periodToDate, 1);
  const durationMs = periodToExclusive.getTime() - periodFromDate.getTime();
  const previousFrom = new Date(periodFromDate.getTime() - durationMs);
  const [documents, previousDocuments] = await Promise.all([
    repository.listDocumentProjection({ branchId, periodView, periodFrom: periodFromDate, periodToExclusive }),
    repository.listDocumentProjection({ branchId, periodView, periodFrom: previousFrom, periodToExclusive: periodFromDate }),
  ]);
  return aggregateDocuments({
    branchId,
    periodView,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    documents,
    previousDocuments,
  });
};

module.exports = Object.freeze({ aggregateDocuments, getInputTaxOverview, projectDocumentReconciliation });