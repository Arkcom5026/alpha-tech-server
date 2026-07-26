class TaxAuthoritySubmissionContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionContractError';
    this.code = code;
    this.details = details;
  }
}

const TAX_AUTHORITY_SUBMISSION_ACTIONS = Object.freeze({
  ENQUEUE: 'ENQUEUE',
  CLAIM: 'CLAIM',
  RETRY: 'RETRY',
  CANCEL: 'CANCEL',
});

const requireNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TaxAuthoritySubmissionContractError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
      `${field} must be a non-empty string`,
      { field, value },
    );
  }

  return value.trim();
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TaxAuthoritySubmissionContractError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
      `${field} must be a positive integer`,
      { field, value },
    );
  }

  return value;
};

const requireNonNegativeInteger = (value, field) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new TaxAuthoritySubmissionContractError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
      `${field} must be a non-negative integer`,
      { field, value },
    );
  }

  return value;
};

const normalizeOccurredAt = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxAuthoritySubmissionContractError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
      'occurredAt must be a valid date',
      { field: 'occurredAt', value },
    );
  }

  return date;
};

const normalizeTaxAuthoritySubmissionCommand = (input, expectedAction) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TaxAuthoritySubmissionContractError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
      'Tax authority submission command must be an object',
    );
  }

  const action = requireNonEmptyString(input.action, 'action');

  if (!Object.values(TAX_AUTHORITY_SUBMISSION_ACTIONS).includes(action)) {
    throw new TaxAuthoritySubmissionContractError(
      'UNSUPPORTED_TAX_AUTHORITY_SUBMISSION_ACTION',
      'Unsupported tax authority submission action',
      { action },
    );
  }

  if (expectedAction && action !== expectedAction) {
    throw new TaxAuthoritySubmissionContractError(
      'TAX_AUTHORITY_SUBMISSION_ACTION_MISMATCH',
      `Expected ${expectedAction} submission action`,
      { expectedAction, receivedAction: action },
    );
  }

  const actorEmployeeId =
    input.actorEmployeeId === null || input.actorEmployeeId === undefined
      ? null
      : requirePositiveInteger(input.actorEmployeeId, 'actorEmployeeId');

  return Object.freeze({
    action,
    submissionId:
      input.submissionId === null || input.submissionId === undefined
        ? null
        : requireNonEmptyString(String(input.submissionId), 'submissionId'),
    taxDocumentId: requireNonEmptyString(
      String(input.taxDocumentId ?? ''),
      'taxDocumentId',
    ),
    providerKey: requireNonEmptyString(input.providerKey, 'providerKey'),
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
    workerId:
      input.workerId === null || input.workerId === undefined
        ? null
        : requireNonEmptyString(input.workerId, 'workerId'),
    leaseUntil:
      input.leaseUntil === null || input.leaseUntil === undefined
        ? null
        : normalizeOccurredAt(input.leaseUntil),
  });
};

module.exports = {
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TaxAuthoritySubmissionContractError,
  normalizeTaxAuthoritySubmissionCommand,
};
