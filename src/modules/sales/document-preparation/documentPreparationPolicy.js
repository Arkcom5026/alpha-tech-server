'use strict';

const PREPARATION_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  LOCKED: 'LOCKED',
  CANCELLED: 'CANCELLED',
});

const TAX_PORTIONS = Object.freeze({
  IN_BUDGET: 'IN_BUDGET',
  OUT_OF_BUDGET: 'OUT_OF_BUDGET',
});

const TAX_INVOICE_KINDS = Object.freeze({
  FULL: 'FULL',
  SHORT: 'SHORT',
});

const OUT_OF_BUDGET_LINE_TYPE = 'SERVICE_ONLY';

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const toCents = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    fail('DOCUMENT_PREPARATION_AMOUNT_INVALID', `${field} must be a non-negative number`);
  }
  return Math.round((number + Number.EPSILON) * 100);
};

const fromCents = (value) => Number((Number(value) / 100).toFixed(2));

const calculateDocumentTotal = (lines = []) => {
  if (!Array.isArray(lines)) {
    fail('DOCUMENT_PREPARATION_LINES_INVALID', 'lines must be an array');
  }

  return fromCents(lines.reduce((total, line, index) => {
    const quantity = Number(line?.quantity ?? 0);
    const unitPrice = Number(line?.unitPrice ?? 0);
    const explicitAmount = line?.amount;

    if (!Number.isFinite(quantity) || quantity < 0) {
      fail('DOCUMENT_PREPARATION_QUANTITY_INVALID', `lines[${index}].quantity must be non-negative`);
    }

    const lineCents = explicitAmount == null
      ? Math.round(quantity * toCents(unitPrice, `lines[${index}].unitPrice`))
      : toCents(explicitAmount, `lines[${index}].amount`);

    return total + lineCents;
  }, 0));
};

const buildPreparationTaxProjection = ({ sourceTotal, lines = [] } = {}) => {
  const sourceCents = toCents(sourceTotal, 'sourceTotal');
  const documentCents = toCents(calculateDocumentTotal(lines), 'documentTotal');

  if (documentCents > sourceCents) {
    fail(
      'DOCUMENT_PREPARATION_TOTAL_EXCEEDS_SOURCE',
      'Prepared document total cannot exceed source transaction total',
      409,
    );
  }

  const outOfBudgetCents = sourceCents - documentCents;
  const fullTotal = fromCents(documentCents);
  const shortTotal = fromCents(outOfBudgetCents);
  const sourceAmount = fromCents(sourceCents);

  const projections = [Object.freeze({
    portion: TAX_PORTIONS.IN_BUDGET,
    taxInvoiceKind: TAX_INVOICE_KINDS.FULL,
    totalAmount: fullTotal,
    requiresRecipientIdentity: true,
    lineType: 'MANUAL_DOCUMENT_LINES',
  })];

  if (outOfBudgetCents > 0) {
    projections.push(Object.freeze({
      portion: TAX_PORTIONS.OUT_OF_BUDGET,
      taxInvoiceKind: TAX_INVOICE_KINDS.SHORT,
      totalAmount: shortTotal,
      requiresRecipientIdentity: false,
      lineType: OUT_OF_BUDGET_LINE_TYPE,
    }));
  }

  const projectedTotalCents = projections.reduce(
    (sum, projection) => sum + toCents(projection.totalAmount, 'projection.totalAmount'),
    0,
  );

  if (projectedTotalCents !== sourceCents) {
    fail(
      'DOCUMENT_PREPARATION_TAX_RECONCILIATION_FAILED',
      'Full and short tax projections must reconcile to source transaction total',
      409,
    );
  }

  return Object.freeze({
    sourceTotal: sourceAmount,
    documentTotal: fullTotal,
    outOfBudgetTotal: shortTotal,
    projections: Object.freeze(projections),
  });
};

module.exports = Object.freeze({
  PREPARATION_STATUSES,
  TAX_PORTIONS,
  TAX_INVOICE_KINDS,
  OUT_OF_BUDGET_LINE_TYPE,
  calculateDocumentTotal,
  buildPreparationTaxProjection,
});
