const {
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TaxAuthoritySubmissionContractError,
  normalizeTaxAuthoritySubmissionCommand,
} = require('../contracts/taxAuthoritySubmissionCommand');
const {
  TAX_AUTHORITY_SUBMISSION_EVENT_TYPES,
  TAX_AUTHORITY_SUBMISSION_STATUSES,
  assertCanCancelSubmission,
  assertCanEnqueue,
  assertCanRetry,
} = require('../policies/taxAuthoritySubmissionPolicy');

class TaxAuthoritySubmissionRuntimeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionRuntimeError';
    this.code = code;
    this.details = details;
  }
}

const normalizeAggregate = (aggregate) => {
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_AGGREGATE',
      'Tax authority submission aggregate must be an object',
    );
  }

  const id = String(aggregate.id ?? '').trim();
  const taxDocumentId = String(aggregate.taxDocumentId ?? '').trim();
  const providerKey = String(aggregate.providerKey ?? '').trim();

  if (!id || !taxDocumentId || !providerKey) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_AGGREGATE',
      'Submission id, taxDocumentId, and providerKey are required',
      { id, taxDocumentId, providerKey },
    );
  }

  if (!Number.isInteger(aggregate.version) || aggregate.version < 0) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_VERSION',
      'Submission aggregate version must be a non-negative integer',
      { version: aggregate.version },
    );
  }

  return Object.freeze({ ...aggregate, id, taxDocumentId, providerKey });
};

const assertCommandTargetsAggregate = (aggregate, command) => {
  if (command.submissionId && aggregate.id !== command.submissionId) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'TAX_AUTHORITY_SUBMISSION_IDENTITY_MISMATCH',
      'Submission command targets a different submission',
      { aggregateId: aggregate.id, commandSubmissionId: command.submissionId },
    );
  }

  if (
    aggregate.taxDocumentId !== command.taxDocumentId ||
    aggregate.providerKey !== command.providerKey
  ) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'TAX_AUTHORITY_SUBMISSION_TARGET_MISMATCH',
      'Submission command target does not match aggregate authority context',
      {
        aggregateTaxDocumentId: aggregate.taxDocumentId,
        commandTaxDocumentId: command.taxDocumentId,
        aggregateProviderKey: aggregate.providerKey,
        commandProviderKey: command.providerKey,
      },
    );
  }

  if (aggregate.version !== command.expectedVersion) {
    throw new TaxAuthoritySubmissionRuntimeError(
      'TAX_AUTHORITY_SUBMISSION_VERSION_CONFLICT',
      'Submission version does not match expectedVersion',
      {
        actualVersion: aggregate.version,
        expectedVersion: command.expectedVersion,
      },
    );
  }
};

const createEvent = ({ aggregate, command, eventType, version }) =>
  Object.freeze({
    eventType,
    aggregateId: aggregate.id,
    aggregateVersion: version,
    taxDocumentId: aggregate.taxDocumentId,
    providerKey: aggregate.providerKey,
    occurredAt: command.occurredAt,
    performedByEmployeeId: command.actorEmployeeId,
    correlationId: command.correlationId,
    metadata: Object.freeze({
      commandKey: command.commandKey,
      reason: command.reason,
    }),
  });

const transition = ({ aggregate: inputAggregate, input, action }) => {
  const aggregate = normalizeAggregate(inputAggregate);
  const command = normalizeTaxAuthoritySubmissionCommand(input, action);

  assertCommandTargetsAggregate(aggregate, command);

  let status;
  let eventType;

  switch (action) {
    case TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE:
      assertCanEnqueue(aggregate.status);
      status = TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED;
      eventType = TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.ENQUEUED;
      break;
    case TAX_AUTHORITY_SUBMISSION_ACTIONS.RETRY:
      assertCanRetry(aggregate.status);
      status = TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED;
      eventType = TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.RETRY_QUEUED;
      break;
    case TAX_AUTHORITY_SUBMISSION_ACTIONS.CANCEL:
      assertCanCancelSubmission(aggregate.status);
      status = TAX_AUTHORITY_SUBMISSION_STATUSES.CANCELLED;
      eventType = TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.CANCELLED;
      break;
    default:
      throw new TaxAuthoritySubmissionContractError(
        'UNSUPPORTED_TAX_AUTHORITY_SUBMISSION_ACTION',
        'Unsupported tax authority submission action',
        { action },
      );
  }

  const version = aggregate.version + 1;
  const nextAggregate = Object.freeze({ ...aggregate, status, version });

  return Object.freeze({
    aggregate: nextAggregate,
    event: createEvent({ aggregate, command, eventType, version }),
  });
};

const enqueueSubmission = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE,
  });

const retrySubmission = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_AUTHORITY_SUBMISSION_ACTIONS.RETRY,
  });

const cancelSubmission = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_AUTHORITY_SUBMISSION_ACTIONS.CANCEL,
  });

module.exports = {
  TaxAuthoritySubmissionRuntimeError,
  cancelSubmission,
  enqueueSubmission,
  retrySubmission,
};
