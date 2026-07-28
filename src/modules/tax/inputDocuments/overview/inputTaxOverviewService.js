'use strict';

const repository = require('./inputTaxOverviewRepository');
const { PERIOD_VIEWS, createEmptyOverview } = require('./inputTaxOverviewContract');

const ACTIVE_STATUSES = new Set(['DRAFT', 'ISSUED', 'APPROVED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'VOIDED', 'REPLACED']);
const RECONCILIATION_TOLERANCE = 0.01;

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
const diff = (left, right) => Math.abs(amount(left) - amount(right));
const isMatched = (document) => document.linkedReceiptCount > 0
  && diff(document.subtotalAmount, document.allocatedSubtotal) <= RECONCILIATION_TOLERANCE
  && diff(document.vatAmount, document.allocatedVatAmount) <= RECONCILIATION_TOLERANCE
  && diff(document.totalAmount, document.allocatedTotalAmount) <= RECONCILIATION_TOLERANCE;

const percentChange = (current, previous) => {
  if (amount(previous) === 0) return { value: null, reason: 'NO_COMPARABLE_BASE' };
  return { value: (((amount(current) - amount(previous)) / amount(previous)) * 100).toFixed(4), reason: null };
};

const aggregateDocuments = ({ branchId, periodView, periodFrom, periodTo, documents, previousDocuments }) => {
  const result = createEmptyOverview({ branchId, periodView, periodFrom, periodTo });
  const activeDocuments = documents.filter(isActive);
  const cancelledDocuments = documents.filter(isCancelled);
  const previousActive = previousDocuments.filter(isActive);
  const sum = (rows, field) => rows.reduce((total, row) => total + amount(row[field]), 0);
  const reconciled = activeDocuments.filter(isMatched);
  const unlinked = activeDocuments.filter((row) => row.linkedReceiptCount === 0);
  const mismatched = activeDocuments.filter((row) => row.linkedReceiptCount > 0 && !isMatched(row));
  const blocked = [...unlinked, ...mismatched];
  const ready = reconciled;

  result.headline.documentCount = documents.length;
  result.headline.activeDocumentCount = activeDocuments.length;
  result.headline.cancelledDocumentCount = cancelledDocuments.length;
  result.headline.subtotalAmount = money(sum(activeDocuments, 'subtotalAmount'));
  result.headline.vatAmount = money(sum(activeDocuments, 'vatAmount'));
  result.headline.totalAmount = money(sum(activeDocuments, 'totalAmount'));
  result.headline.reconciledVatAmount = money(sum(reconciled, 'vatAmount'));
  result.headline.claimableVatAmount = money(sum(ready, 'vatAmount'));
  result.headline.blockedVatAmount = money(sum(blocked, 'vatAmount'));

  const previousVat = sum(previousActive, 'vatAmount');
  const previousClaimableVat = sum(previousActive.filter(isMatched), 'vatAmount');
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
    (total, row) => total + diff(row.totalAmount, row.allocatedTotalAmount), 0,
  ));
  result.reconciliation.unreconciledVatAmount = money(sum(blocked, 'vatAmount'));

  const missingTaxId = activeDocuments.filter((row) => !supplierTaxId(row));
  const missingNumber = activeDocuments.filter((row) => !normalizeText(row.documentNumber));
  const attentionIds = new Set([...unlinked, ...mismatched, ...missingTaxId, ...missingNumber].map((row) => row.id));
  result.quality.missingSupplierTaxIdCount = missingTaxId.length;
  result.quality.missingInvoiceNumberCount = missingNumber.length;
  result.quality.attentionItemCount = attentionIds.size;
  result.quality.hasAttentionItems = attentionIds.size > 0;

  result.filingReadiness.readyDocumentCount = ready.length;
  result.filingReadiness.blockedDocumentCount = blocked.length;
  result.filingReadiness.readyVatAmount = money(sum(ready, 'vatAmount'));
  result.filingReadiness.blockedVatAmount = money(sum(blocked, 'vatAmount'));
  result.filingReadiness.blockerSummary = [
    { code: 'UNLINKED_DOCUMENT', documentCount: unlinked.length, vatAmount: money(sum(unlinked, 'vatAmount')) },
    { code: 'ALLOCATION_MISMATCH', documentCount: mismatched.length, vatAmount: money(sum(mismatched, 'vatAmount')) },
  ].filter((item) => item.documentCount > 0);

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
  result.recentDocuments = documents.slice(0, 10).map((row) => ({
    taxDocumentId: row.id,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    documentDate: row.issuedAt,
    receivedAt: row.occurredAt,
    supplier: { name: supplierName(row), taxId: supplierTaxId(row) || null },
    amounts: {
      subtotalAmount: row.subtotalAmount,
      vatAmount: row.vatAmount,
      totalAmount: row.totalAmount,
    },
    sourceTypes: row.sourceTypes,
    linkedReceiptCount: row.linkedReceiptCount,
    reconciliationStatus: row.linkedReceiptCount === 0 ? 'UNLINKED' : (isMatched(row) ? 'MATCHED' : 'MISMATCHED'),
    filingStatus: 'NOT_SELECTED',
    attentionReasons: [
      row.linkedReceiptCount === 0 ? 'UNLINKED_DOCUMENT' : null,
      row.linkedReceiptCount > 0 && !isMatched(row) ? 'ALLOCATION_MISMATCH' : null,
      !supplierTaxId(row) ? 'MISSING_SUPPLIER_TAX_ID' : null,
      !normalizeText(row.documentNumber) ? 'MISSING_INVOICE_NUMBER' : null,
    ].filter(Boolean),
    updatedAt: row.updatedAt,
  }));
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
  if (periodView !== 'DOCUMENT') {
    throw Object.assign(new Error('Only DOCUMENT period view is implemented in Increment 1'), {
      code: 'INPUT_TAX_OVERVIEW_PERIOD_VIEW_NOT_IMPLEMENTED', statusCode: 400,
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
    repository.listDocumentProjection({ branchId, periodFrom: periodFromDate, periodToExclusive }),
    repository.listDocumentProjection({ branchId, periodFrom: previousFrom, periodToExclusive: periodFromDate }),
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

module.exports = Object.freeze({ aggregateDocuments, getInputTaxOverview });
