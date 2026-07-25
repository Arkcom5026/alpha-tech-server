const {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
} = require('./taxDocumentSourceTypes');

class TaxDocumentContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxDocumentContractError';
    this.code = code;
    this.details = details;
  }
}

const requirePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      `${field} must be a positive integer`,
      { field, value },
    );
  }

  return value;
};

const requireNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      `${field} must be a non-empty string`,
      { field, value },
    );
  }

  return value.trim();
};

const optionalNonEmptyString = (value, field) => {
  if (value === null || value === undefined) return null;
  return requireNonEmptyString(value, field);
};

const normalizeMoney = (value, field) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      `${field} must be a non-negative monetary value`,
      { field, value },
    );
  }

  return number.toFixed(2);
};

const normalizeRate = (value, field) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      `${field} must be between 0 and 100`,
      { field, value },
    );
  }

  return number.toFixed(2);
};

const normalizeOccurredAt = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      'occurredAt must be a valid date',
      { field: 'occurredAt', value },
    );
  }

  return date;
};

const normalizeTaxDocumentCommand = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      'Tax document command must be an object',
    );
  }

  if (!isTaxDocumentSourceType(input.sourceType)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_SOURCE_TYPE',
      'Unsupported tax document source type',
      { sourceType: input.sourceType },
    );
  }

  if (!isTaxDocumentType(input.documentType)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_TYPE',
      'Unsupported tax document type',
      { documentType: input.documentType },
    );
  }

  if (!isTaxDocumentDirection(input.direction)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_DIRECTION',
      'Unsupported tax document direction',
      { direction: input.direction },
    );
  }

  if (
    input.sourceType === TAX_DOCUMENT_SOURCE_TYPES.SALE &&
    input.direction !== TAX_DOCUMENT_DIRECTIONS.OUTPUT
  ) {
    throw new TaxDocumentContractError(
      'TAX_DOCUMENT_DIRECTION_MISMATCH',
      'SALE source must create an OUTPUT tax document',
    );
  }

  if (
    input.sourceType === TAX_DOCUMENT_SOURCE_TYPES.PURCHASE_RECEIPT &&
    input.direction !== TAX_DOCUMENT_DIRECTIONS.INPUT
  ) {
    throw new TaxDocumentContractError(
      'TAX_DOCUMENT_DIRECTION_MISMATCH',
      'PURCHASE_RECEIPT source must create an INPUT tax document',
    );
  }

  const normalized = {
    branchId: requirePositiveInteger(input.branchId, 'branchId'),
    sourceType: input.sourceType,
    sourceId: requireNonEmptyString(String(input.sourceId ?? ''), 'sourceId'),
    sourceVersion: Number.isInteger(input.sourceVersion)
      ? input.sourceVersion
      : 1,
    documentType: input.documentType,
    direction: input.direction,
    documentNumber: optionalNonEmptyString(
      input.documentNumber,
      'documentNumber',
    ),
    occurredAt: normalizeOccurredAt(input.occurredAt),
    currency: optionalNonEmptyString(input.currency, 'currency') || 'THB',
    subtotalAmount: normalizeMoney(
      input.subtotalAmount,
      'subtotalAmount',
    ),
    discountAmount: normalizeMoney(
      input.discountAmount ?? 0,
      'discountAmount',
    ),
    taxableAmount: normalizeMoney(
      input.taxableAmount,
      'taxableAmount',
    ),
    vatRate: normalizeRate(input.vatRate, 'vatRate'),
    vatAmount: normalizeMoney(input.vatAmount, 'vatAmount'),
    totalAmount: normalizeMoney(input.totalAmount, 'totalAmount'),
    actorEmployeeId:
      input.actorEmployeeId === null ||
      input.actorEmployeeId === undefined
        ? null
        : requirePositiveInteger(
            input.actorEmployeeId,
            'actorEmployeeId',
          ),
    correlationId: optionalNonEmptyString(
      input.correlationId,
      'correlationId',
    ),
    commandKey: requireNonEmptyString(
      input.commandKey,
      'commandKey',
    ),
  };

  if (normalized.sourceVersion <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_COMMAND',
      'sourceVersion must be a positive integer',
      {
        field: 'sourceVersion',
        value: normalized.sourceVersion,
      },
    );
  }

  const expectedTotal = (
    Number(normalized.taxableAmount) +
    Number(normalized.vatAmount)
  ).toFixed(2);

  if (expectedTotal !== normalized.totalAmount) {
    throw new TaxDocumentContractError(
      'TAX_DOCUMENT_TOTAL_MISMATCH',
      'totalAmount must equal taxableAmount plus vatAmount',
      {
        expectedTotal,
        receivedTotal: normalized.totalAmount,
      },
    );
  }

  return Object.freeze(normalized);
};

module.exports = {
  TaxDocumentContractError,
  normalizeTaxDocumentCommand,
};
