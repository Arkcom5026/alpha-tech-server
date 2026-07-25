class TaxDocumentLifecycleContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxDocumentLifecycleContractError';
    this.code = code;
    this.details = details;
  }
}

const TAX_DOCUMENT_LIFECYCLE_ACTIONS = Object.freeze({
  ISSUE: 'ISSUE',
  CANCEL: 'CANCEL',
  CREATE_CREDIT_NOTE: 'CREATE_CREDIT_NOTE',
  CREATE_DEBIT_NOTE: 'CREATE_DEBIT_NOTE',
});

const requireNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TaxDocumentLifecycleContractError(
      'INVALID_TAX_DOCUMENT_LIFECYCLE_COMMAND',
      `${field} must be a non-empty string`,
      { field, value },
    );
  }

  return value.trim();
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TaxDocumentLifecycleContractError(
      'INVALID_TAX_DOCUMENT_LIFECYCLE_COMMAND',
      `${field} must be a positive integer`,
      { field, value },
    );
  }

  return value;
};

const requireNonNegativeInteger = (value, field) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new TaxDocumentLifecycleContractError(
      'INVALID_TAX_DOCUMENT_LIFECYCLE_COMMAND',
      `${field} must be a non-negative integer`,
      { field, value },
    );
  }

  return value;
};

const normalizeOccurredAt = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentLifecycleContractError(
      'INVALID_TAX_DOCUMENT_LIFECYCLE_COMMAND',
      'occurredAt must be a valid date',
      { field: 'occurredAt', value },
    );
  }

  return date;
};

const normalizeTaxDocumentLifecycleCommand = (input, expectedAction) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TaxDocumentLifecycleContractError(
      'INVALID_TAX_DOCUMENT_LIFECYCLE_COMMAND',
      'Tax document lifecycle command must be an object',
    );
  }

  const action = requireNonEmptyString(input.action, 'action');

  if (!Object.values(TAX_DOCUMENT_LIFECYCLE_ACTIONS).includes(action)) {
    throw new TaxDocumentLifecycleContractError(
      'UNSUPPORTED_TAX_DOCUMENT_LIFECYCLE_ACTION',
      'Unsupported tax document lifecycle action',
      { action },
    );
  }

  if (expectedAction && action !== expectedAction) {
    throw new TaxDocumentLifecycleContractError(
      'TAX_DOCUMENT_LIFECYCLE_ACTION_MISMATCH',
      `Expected ${expectedAction} lifecycle action`,
      { expectedAction, receivedAction: action },
    );
  }

  const actorEmployeeId =
    input.actorEmployeeId === null || input.actorEmployeeId === undefined
      ? null
      : requirePositiveInteger(input.actorEmployeeId, 'actorEmployeeId');

  return Object.freeze({
    action,
    taxDocumentId: requireNonEmptyString(
      String(input.taxDocumentId ?? ''),
      'taxDocumentId',
    ),
    expectedVersion: requireNonNegativeInteger(
      input.expectedVersion,
      'expectedVersion',
    ),
    commandKey: requireNonEmptyString(input.commandKey, 'commandKey'),
    correlationId:
      input.correlationId === null || input.correlationId === undefined
        ? null
        : requireNonEmptyString(input.correlationId, 'correlationId'),
    actorEmployeeId,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    reason:
      input.reason === null || input.reason === undefined
        ? null
        : requireNonEmptyString(input.reason, 'reason'),
    relatedTaxDocumentId:
      input.relatedTaxDocumentId === null ||
      input.relatedTaxDocumentId === undefined
        ? null
        : requireNonEmptyString(
            String(input.relatedTaxDocumentId),
            'relatedTaxDocumentId',
          ),
  });
};

module.exports = {
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TaxDocumentLifecycleContractError,
  normalizeTaxDocumentLifecycleCommand,
};
