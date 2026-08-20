'use strict';

const amount = (value) => Number(Number(value || 0).toFixed(2));

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const parseDocumentPreparationSourceId = (sourceId) => {
  const match = String(sourceId || '').trim().match(/^(\d+):(IN_BUDGET|OUT_OF_BUDGET)$/);
  if (!match) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_SOURCE_INVALID',
      'Document preparation tax source identity is invalid',
    );
  }
  return Object.freeze({ preparationId: Number(match[1]), portion: match[2] });
};

const mapTaxLine = (line, index, portion, replacementLine = false) => Object.freeze({
  id: replacementLine
    ? `replacement-tax-${portion}-${index + 1}`
    : `preparation-tax-${portion}-${index + 1}`,
  description: String(line?.description || '').trim() || 'Document item',
  quantity: Number(line?.quantity || 0),
  unitName: String(line?.unitName || '').trim() || null,
  unitAmount: amount(line?.unitPrice ?? line?.unitAmount),
  discountAmount: 0,
  lineAmount: amount(line?.amount ?? line?.lineAmount),
  vatAmount: 0,
  barcode: null,
  portion,
  replacementLine,
});

const buildFallbackLines = ({ documentSnapshot, portion }) => {
  const items = Array.isArray(documentSnapshot?.items) ? documentSnapshot.items : [];
  return Object.freeze(items.map((line, index) => mapTaxLine(line, index, portion, false)));
};

const assertReplacementMatchesTaxAuthority = ({ replacement, document, portion }) => {
  const financialLock = replacement?.financialLock || replacement?.finalSnapshot?.financialLock || null;
  const lockedPortion = Array.isArray(financialLock?.portions)
    ? financialLock.portions.find((entry) => String(entry?.portion || '').toUpperCase() === portion)
    : null;
  if (!lockedPortion) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_FINANCIAL_LOCK_MISSING',
      `Replacement financial lock for ${portion} is missing`,
    );
  }

  const expectedKind = String(lockedPortion.taxInvoiceKind || '').toUpperCase();
  const actualKind = String(document?.taxInvoiceKind || '').toUpperCase();
  if (expectedKind !== actualKind) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_KIND_CHANGED',
      `Replacement cannot change ${portion} tax invoice kind`,
    );
  }

  const checks = [
    ['subtotalAmount', lockedPortion.subtotalAmount, document?.subtotalAmount],
    ['taxAmount', lockedPortion.taxAmount, document?.taxAmount],
    ['totalAmount', lockedPortion.totalAmount, document?.totalAmount],
  ];
  for (const [field, expected, actual] of checks) {
    if (amount(expected) !== amount(actual)) {
      fail(
        'DOCUMENT_REPLACEMENT_TAX_FINANCIAL_AUTHORITY_CHANGED',
        `Replacement ${portion} ${field} no longer matches issued tax authority`,
      );
    }
  }
};

const loadDocumentPreparationReplacementTaxProjection = async ({
  prisma,
  branchId,
  document,
} = {}) => {
  const source = parseDocumentPreparationSourceId(document?.candidate?.sourceId);
  const snapshot = document?.snapshot || {};

  if (Number(snapshot?.preparationId || 0) !== source.preparationId) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_SOURCE_MISMATCH',
      'Tax document snapshot does not match its document preparation source',
    );
  }
  if (String(snapshot?.portion || '').toUpperCase() !== source.portion) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_PORTION_MISMATCH',
      'Tax document snapshot portion does not match its source identity',
    );
  }

  const currentKey = `${Number(branchId)}:${source.preparationId}:CURRENT`;
  const replacement = await prisma.saleDocumentReplacement.findUnique({
    where: { currentKey },
  });

  if (!replacement || replacement.status !== 'LOCKED' || !replacement.finalSnapshot) {
    return Object.freeze({
      preparationId: source.preparationId,
      portion: source.portion,
      sourceSaleId: Number(snapshot?.sourceSaleId || 0) || null,
      sourceSaleCode: snapshot?.sourceSaleCode || null,
      sourceDeliveryNoteNumber: snapshot?.sourceDeliveryNoteNumber || null,
      replacement: null,
      lines: buildFallbackLines({ documentSnapshot: snapshot, portion: source.portion }),
    });
  }

  assertReplacementMatchesTaxAuthority({ replacement, document, portion: source.portion });

  const replacementLines = (Array.isArray(replacement.finalSnapshot?.lines)
    ? replacement.finalSnapshot.lines
    : [])
    .filter((line) => String(line?.portion || '').toUpperCase() === source.portion)
    .sort((left, right) => Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0))
    .map((line, index) => mapTaxLine(line, index, source.portion, true));

  if (!replacementLines.length) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_LINES_MISSING',
      `Current replacement has no ${source.portion} lines for tax printing`,
    );
  }

  const projectedTotal = amount(replacementLines.reduce((sum, line) => sum + Number(line.lineAmount || 0), 0));
  if (projectedTotal !== amount(document.totalAmount)) {
    fail(
      'DOCUMENT_REPLACEMENT_TAX_LINE_TOTAL_CHANGED',
      `Replacement ${source.portion} line total must equal the issued tax document total`,
    );
  }

  return Object.freeze({
    preparationId: source.preparationId,
    portion: source.portion,
    sourceSaleId: Number(snapshot?.sourceSaleId || 0) || null,
    sourceSaleCode: snapshot?.sourceSaleCode || null,
    sourceDeliveryNoteNumber: snapshot?.sourceDeliveryNoteNumber || null,
    replacement: Object.freeze({
      replacementId: Number(replacement.id),
      replacementNumber: Number(replacement.replacementNumber || replacement.finalSnapshot?.replacementNumber || 0),
      replacesReplacementId: replacement.replacesReplacementId == null
        ? null
        : Number(replacement.replacesReplacementId),
      reason: replacement.reason || replacement.finalSnapshot?.reason || null,
      lockedAt: replacement.lockedAt || replacement.finalSnapshot?.lockedAt || null,
    }),
    lines: Object.freeze(replacementLines),
  });
};

module.exports = Object.freeze({
  assertReplacementMatchesTaxAuthority,
  buildFallbackLines,
  loadDocumentPreparationReplacementTaxProjection,
  mapTaxLine,
  parseDocumentPreparationSourceId,
});
