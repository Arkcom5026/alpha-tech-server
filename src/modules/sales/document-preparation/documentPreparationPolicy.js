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
const OUT_OF_BUDGET_SERVICE_DESCRIPTION = 'ค่าบริการ';

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

const buildLockedPreparationSnapshot = ({
  preparationId,
  sourceSale,
  sourceTotal,
  agencyContext,
  lines = [],
  lockedAt,
  lockedById,
} = {}) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    fail('DOCUMENT_PREPARATION_LINES_REQUIRED_FOR_LOCK', 'At least one prepared document line is required before lock', 409);
  }

  const projection = buildPreparationTaxProjection({ sourceTotal, lines });
  if (projection.documentTotal <= 0) {
    fail('DOCUMENT_PREPARATION_TOTAL_REQUIRED_FOR_LOCK', 'Prepared document total must be greater than zero before lock', 409);
  }

  const normalizedLockedAt = new Date(lockedAt || Date.now());
  if (Number.isNaN(normalizedLockedAt.getTime())) {
    fail('DOCUMENT_PREPARATION_LOCK_TIME_INVALID', 'lockedAt is invalid');
  }

  const snapshotLines = lines.map((line, index) => Object.freeze({
    description: String(line?.description || '').trim(),
    quantity: Number(line?.quantity || 0),
    unitName: String(line?.unitName || '').trim() || null,
    unitPrice: fromCents(toCents(line?.unitPrice || 0, `lines[${index}].unitPrice`)),
    amount: fromCents(toCents(line?.amount || 0, `lines[${index}].amount`)),
    sortOrder: Number.isInteger(Number(line?.sortOrder)) ? Number(line.sortOrder) : index,
  }));

  const outOfBudgetService = projection.outOfBudgetTotal > 0
    ? Object.freeze({
        description: OUT_OF_BUDGET_SERVICE_DESCRIPTION,
        quantity: 1,
        unitName: 'รายการ',
        unitPrice: projection.outOfBudgetTotal,
        amount: projection.outOfBudgetTotal,
        lineType: OUT_OF_BUDGET_LINE_TYPE,
      })
    : null;

  return Object.freeze({
    schemaVersion: 1,
    preparationId: Number(preparationId),
    source: Object.freeze({
      type: 'SALE',
      saleId: Number(sourceSale?.id || 0),
      saleCode: sourceSale?.code || null,
      deliveryNoteNumber: sourceSale?.officialDocumentNumber || null,
      totalAmount: projection.sourceTotal,
    }),
    agency: agencyContext && typeof agencyContext === 'object'
      ? Object.freeze({ ...agencyContext })
      : null,
    lines: Object.freeze(snapshotLines),
    totals: Object.freeze({
      sourceTotal: projection.sourceTotal,
      inBudgetTotal: projection.documentTotal,
      outOfBudgetTotal: projection.outOfBudgetTotal,
    }),
    taxProjection: projection.projections,
    outOfBudgetService,
    lockedAt: normalizedLockedAt.toISOString(),
    lockedById: lockedById == null ? null : Number(lockedById),
  });
};

module.exports = Object.freeze({
  PREPARATION_STATUSES,
  TAX_PORTIONS,
  TAX_INVOICE_KINDS,
  OUT_OF_BUDGET_LINE_TYPE,
  OUT_OF_BUDGET_SERVICE_DESCRIPTION,
  calculateDocumentTotal,
  buildPreparationTaxProjection,
  buildLockedPreparationSnapshot,
});
