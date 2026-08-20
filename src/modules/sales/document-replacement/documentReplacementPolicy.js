'use strict';

const FORBIDDEN_SOURCE_IDENTITY_FIELDS = Object.freeze([
  'productId',
  'stockItemId',
  'simpleLotId',
  'saleItemId',
  'saleItemSimpleId',
]);

const fail = (code, message, statusCode = 400, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  throw error;
};

const toCents = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    fail('DOCUMENT_REPLACEMENT_AMOUNT_INVALID', `${field} must be a non-negative number`);
  }
  return Math.round((number + Number.EPSILON) * 100);
};

const fromCents = (value) => Number((Number(value) / 100).toFixed(2));

const assertDetachedLine = (line, index) => {
  for (const field of FORBIDDEN_SOURCE_IDENTITY_FIELDS) {
    if (line?.[field] != null) {
      fail(
        'DOCUMENT_REPLACEMENT_SOURCE_IDENTITY_FORBIDDEN',
        `Replacement line ${index} cannot carry ${field}`,
        409,
        { index, field },
      );
    }
  }
};

const calculateRecomposedTotal = (lines = [], field = 'lines') => {
  if (!Array.isArray(lines)) {
    fail('DOCUMENT_REPLACEMENT_LINES_INVALID', `${field} must be an array`);
  }
  if (lines.length > 200) {
    fail('DOCUMENT_REPLACEMENT_LINES_LIMIT', `${field} cannot contain more than 200 lines`);
  }

  const totalCents = lines.reduce((sum, line, index) => {
    assertDetachedLine(line, index);

    const description = String(line?.description || '').trim();
    if (!description) {
      fail('DOCUMENT_REPLACEMENT_LINE_INVALID', `${field}[${index}].description is required`);
    }

    const quantity = Number(line?.quantity);
    const unitPrice = Number(line?.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fail('DOCUMENT_REPLACEMENT_LINE_INVALID', `${field}[${index}].quantity must be greater than zero`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      fail('DOCUMENT_REPLACEMENT_LINE_INVALID', `${field}[${index}].unitPrice must be non-negative`);
    }

    const computedCents = Math.round(quantity * toCents(unitPrice, `${field}[${index}].unitPrice`));
    if (line?.amount != null && toCents(line.amount, `${field}[${index}].amount`) !== computedCents) {
      fail(
        'DOCUMENT_REPLACEMENT_LINE_AMOUNT_MISMATCH',
        `${field}[${index}].amount must equal quantity x unitPrice`,
        409,
      );
    }
    return sum + computedCents;
  }, 0);

  return fromCents(totalCents);
};

const normalizeVatPortion = (snapshot, portion) => {
  const row = Array.isArray(snapshot?.vatAllocation)
    ? snapshot.vatAllocation.find((entry) => entry?.portion === portion)
    : null;
  if (!row) return null;
  return Object.freeze({
    portion,
    subtotalAmount: fromCents(toCents(row.subtotalAmount, `${portion}.subtotalAmount`)),
    taxAmount: fromCents(toCents(row.taxAmount, `${portion}.taxAmount`)),
    totalAmount: fromCents(toCents(row.totalAmount, `${portion}.totalAmount`)),
  });
};

const normalizeProjection = (snapshot, portion) => {
  const row = Array.isArray(snapshot?.taxProjection)
    ? snapshot.taxProjection.find((entry) => entry?.portion === portion)
    : null;
  if (!row) return null;
  return Object.freeze({
    portion,
    taxInvoiceKind: String(row.taxInvoiceKind || '').trim().toUpperCase(),
    lineType: String(row.lineType || '').trim().toUpperCase(),
    totalAmount: fromCents(toCents(row.totalAmount, `${portion}.projection.totalAmount`)),
  });
};

const buildReplacementFinancialLock = ({ finalSnapshot, taxDocuments = [], taxPeriodByDocumentId = {} } = {}) => {
  if (!finalSnapshot || typeof finalSnapshot !== 'object') {
    fail('DOCUMENT_REPLACEMENT_SOURCE_SNAPSHOT_REQUIRED', 'Locked preparation snapshot is required', 409);
  }

  const sourceTotal = fromCents(toCents(finalSnapshot?.totals?.sourceTotal, 'sourceTotal'));
  const sourceTaxAmount = fromCents(toCents(finalSnapshot?.source?.taxAmount, 'sourceTaxAmount'));
  const vatRate = Number(finalSnapshot?.source?.vatRate || 0);
  const preparationId = Number(finalSnapshot?.preparationId || 0);
  const saleId = Number(finalSnapshot?.source?.saleId || 0);

  if (!Number.isInteger(preparationId) || preparationId <= 0 || !Number.isInteger(saleId) || saleId <= 0) {
    fail('DOCUMENT_REPLACEMENT_SOURCE_IDENTITY_INVALID', 'Locked preparation/source identity is invalid', 409);
  }

  const portions = ['IN_BUDGET'];
  if (toCents(finalSnapshot?.totals?.outOfBudgetTotal || 0, 'outOfBudgetTotal') > 0) {
    portions.push('OUT_OF_BUDGET');
  }

  const lockedPortions = portions.map((portion) => {
    const projection = normalizeProjection(finalSnapshot, portion);
    const vat = normalizeVatPortion(finalSnapshot, portion);
    if (!projection || !vat) {
      fail('DOCUMENT_REPLACEMENT_FINANCIAL_FACTS_INCOMPLETE', `Locked ${portion} tax facts are incomplete`, 409);
    }
    if (toCents(projection.totalAmount, `${portion}.projection.totalAmount`) !== toCents(vat.totalAmount, `${portion}.vat.totalAmount`)) {
      fail('DOCUMENT_REPLACEMENT_FINANCIAL_FACTS_MISMATCH', `Locked ${portion} projection/VAT totals disagree`, 409);
    }

    const document = taxDocuments.find((entry) => entry?.snapshot?.portion === portion) || null;
    return Object.freeze({
      portion,
      taxInvoiceKind: projection.taxInvoiceKind,
      lineType: projection.lineType,
      subtotalAmount: vat.subtotalAmount,
      taxAmount: vat.taxAmount,
      totalAmount: vat.totalAmount,
      taxDocumentId: document?.id == null ? null : Number(document.id),
      issuedDocumentNumber: document?.issuedDocumentNumber || null,
      taxPeriodId: document?.id == null ? null : (taxPeriodByDocumentId?.[document.id] || null),
    });
  });

  const projectedTotalCents = lockedPortions.reduce((sum, portion) => sum + toCents(portion.totalAmount, `${portion.portion}.totalAmount`), 0);
  const projectedTaxCents = lockedPortions.reduce((sum, portion) => sum + toCents(portion.taxAmount, `${portion.portion}.taxAmount`), 0);
  if (projectedTotalCents !== toCents(sourceTotal, 'sourceTotal') || projectedTaxCents !== toCents(sourceTaxAmount, 'sourceTaxAmount')) {
    fail('DOCUMENT_REPLACEMENT_SOURCE_RECONCILIATION_FAILED', 'Locked tax portions do not reconcile to source totals', 409);
  }

  return Object.freeze({
    schemaVersion: 1,
    source: Object.freeze({
      preparationId,
      saleId,
      sourceTotal,
      sourceTaxAmount,
      vatRate,
    }),
    portions: Object.freeze(lockedPortions),
  });
};

const assertReplacementFinancialLock = ({ financialLock, inBudgetLines = [], outOfBudgetLines = [] } = {}) => {
  if (!financialLock || !Array.isArray(financialLock.portions)) {
    fail('DOCUMENT_REPLACEMENT_FINANCIAL_LOCK_REQUIRED', 'Financial lock is required', 409);
  }

  const inBudgetLock = financialLock.portions.find((portion) => portion.portion === 'IN_BUDGET');
  const outOfBudgetLock = financialLock.portions.find((portion) => portion.portion === 'OUT_OF_BUDGET') || null;
  if (!inBudgetLock) {
    fail('DOCUMENT_REPLACEMENT_FINANCIAL_LOCK_INCOMPLETE', 'IN_BUDGET financial lock is missing', 409);
  }

  const inBudgetTotal = calculateRecomposedTotal(inBudgetLines, 'inBudgetLines');
  if (toCents(inBudgetTotal, 'inBudgetTotal') !== toCents(inBudgetLock.totalAmount, 'lockedInBudgetTotal')) {
    fail(
      'DOCUMENT_REPLACEMENT_IN_BUDGET_TOTAL_CHANGED',
      'Replacement IN_BUDGET total must equal the locked original total',
      409,
      { expected: inBudgetLock.totalAmount, actual: inBudgetTotal },
    );
  }

  let outOfBudgetTotal = 0;
  if (outOfBudgetLock) {
    if (String(outOfBudgetLock.taxInvoiceKind).toUpperCase() !== 'SHORT'
      || String(outOfBudgetLock.lineType).toUpperCase() !== 'SERVICE_ONLY') {
      fail('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_AUTHORITY_INVALID', 'OUT_OF_BUDGET must remain SHORT / SERVICE_ONLY', 409);
    }
    if (!Array.isArray(outOfBudgetLines) || outOfBudgetLines.length !== 1) {
      fail('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_SERVICE_REQUIRED', 'OUT_OF_BUDGET replacement requires exactly one SERVICE_ONLY line', 409);
    }
    if (String(outOfBudgetLines[0]?.lineType || 'SERVICE_ONLY').toUpperCase() !== 'SERVICE_ONLY') {
      fail('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_SERVICE_REQUIRED', 'OUT_OF_BUDGET line must remain SERVICE_ONLY', 409);
    }
    outOfBudgetTotal = calculateRecomposedTotal(outOfBudgetLines, 'outOfBudgetLines');
    if (toCents(outOfBudgetTotal, 'outOfBudgetTotal') !== toCents(outOfBudgetLock.totalAmount, 'lockedOutOfBudgetTotal')) {
      fail(
        'DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_TOTAL_CHANGED',
        'Replacement OUT_OF_BUDGET total must equal the locked original total',
        409,
        { expected: outOfBudgetLock.totalAmount, actual: outOfBudgetTotal },
      );
    }
  } else if (Array.isArray(outOfBudgetLines) && outOfBudgetLines.length > 0) {
    fail('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_NOT_ALLOWED', 'Replacement cannot introduce a new OUT_OF_BUDGET portion', 409);
  }

  const total = fromCents(toCents(inBudgetTotal, 'inBudgetTotal') + toCents(outOfBudgetTotal, 'outOfBudgetTotal'));
  if (toCents(total, 'replacementTotal') !== toCents(financialLock.source.sourceTotal, 'lockedSourceTotal')) {
    fail('DOCUMENT_REPLACEMENT_SOURCE_TOTAL_CHANGED', 'Replacement total must reconcile to locked source total', 409);
  }

  return Object.freeze({
    allowed: true,
    sourceTotal: financialLock.source.sourceTotal,
    sourceTaxAmount: financialLock.source.sourceTaxAmount,
    inBudgetTotal,
    outOfBudgetTotal,
    total,
  });
};

module.exports = Object.freeze({
  FORBIDDEN_SOURCE_IDENTITY_FIELDS,
  calculateRecomposedTotal,
  buildReplacementFinancialLock,
  assertReplacementFinancialLock,
});
