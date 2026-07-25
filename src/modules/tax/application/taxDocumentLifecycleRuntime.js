const {
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TaxDocumentLifecycleContractError,
  normalizeTaxDocumentLifecycleCommand,
} = require('../contracts/taxDocumentLifecycleCommand');
const {
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_STATUSES,
  assertCanCancel,
  assertCanCreateAdjustment,
  assertCanIssue,
} = require('../policies/taxDocumentLifecyclePolicy');

class TaxDocumentLifecycleRuntimeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxDocumentLifecycleRuntimeError';
    this.code = code;
    this.details = details;
  }
}

const normalizeAggregate = (aggregate) => {
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) {
    throw new TaxDocumentLifecycleRuntimeError(
      'INVALID_TAX_DOCUMENT_AGGREGATE',
      'Tax document aggregate must be an object',
    );
  }

  const id = String(aggregate.id ?? '').trim();

  if (!id) {
    throw new TaxDocumentLifecycleRuntimeError(
      'INVALID_TAX_DOCUMENT_AGGREGATE',
      'Tax document aggregate id is required',
    );
  }

  if (!Number.isInteger(aggregate.version) || aggregate.version <= 0) {
    throw new TaxDocumentLifecycleRuntimeError(
      'INVALID_TAX_DOCUMENT_AGGREGATE_VERSION',
      'Tax document aggregate version must be a positive integer',
      { version: aggregate.version },
    );
  }

  return Object.freeze({
    ...aggregate,
    id,
  });
};

const assertCommandTargetsAggregate = (aggregate, command) => {
  if (aggregate.id !== command.taxDocumentId) {
    throw new TaxDocumentLifecycleRuntimeError(
      'TAX_DOCUMENT_IDENTITY_MISMATCH',
      'Lifecycle command targets a different tax document',
      {
        aggregateId: aggregate.id,
        commandTaxDocumentId: command.taxDocumentId,
      },
    );
  }

  if (aggregate.version !== command.expectedVersion) {
    throw new TaxDocumentLifecycleRuntimeError(
      'TAX_DOCUMENT_VERSION_CONFLICT',
      'Tax document version does not match expectedVersion',
      {
        actualVersion: aggregate.version,
        expectedVersion: command.expectedVersion,
      },
    );
  }
};

const createLifecycleEvent = ({
  aggregate,
  command,
  eventType,
  version,
}) =>
  Object.freeze({
    eventType,
    aggregateId: aggregate.id,
    aggregateVersion: version,
    occurredAt: command.occurredAt,
    performedByEmployeeId: command.actorEmployeeId,
    correlationId: command.correlationId,
    metadata: Object.freeze({
      commandKey: command.commandKey,
      reason: command.reason,
      relatedTaxDocumentId: command.relatedTaxDocumentId,
    }),
  });

const transition = ({ aggregate: inputAggregate, input, action }) => {
  const aggregate = normalizeAggregate(inputAggregate);
  const command = normalizeTaxDocumentLifecycleCommand(input, action);

  assertCommandTargetsAggregate(aggregate, command);

  let status = aggregate.status;
  let eventType;

  switch (action) {
    case TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE:
      assertCanIssue(aggregate.status);
      status = TAX_DOCUMENT_STATUSES.ISSUED;
      eventType = TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES.ISSUED;
      break;
    case TAX_DOCUMENT_LIFECYCLE_ACTIONS.CANCEL:
      assertCanCancel(aggregate.status);
      status = TAX_DOCUMENT_STATUSES.CANCELLED;
      eventType = TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES.CANCELLED;
      break;
    case TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_CREDIT_NOTE:
      assertCanCreateAdjustment(aggregate.status, 'CREDIT_NOTE');
      eventType = TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES.CREDIT_NOTE_CREATED;
      break;
    case TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_DEBIT_NOTE:
      assertCanCreateAdjustment(aggregate.status, 'DEBIT_NOTE');
      eventType = TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES.DEBIT_NOTE_CREATED;
      break;
    default:
      throw new TaxDocumentLifecycleContractError(
        'UNSUPPORTED_TAX_DOCUMENT_LIFECYCLE_ACTION',
        'Unsupported tax document lifecycle action',
        { action },
      );
  }

  const version = aggregate.version + 1;
  const nextAggregate = Object.freeze({
    ...aggregate,
    status,
    version,
  });

  return Object.freeze({
    aggregate: nextAggregate,
    event: createLifecycleEvent({
      aggregate,
      command,
      eventType,
      version,
    }),
  });
};

const issueDocument = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE,
  });

const cancelDocument = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_DOCUMENT_LIFECYCLE_ACTIONS.CANCEL,
  });

const createCreditNote = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_CREDIT_NOTE,
  });

const createDebitNote = (aggregate, input) =>
  transition({
    aggregate,
    input,
    action: TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_DEBIT_NOTE,
  });

module.exports = {
  TaxDocumentLifecycleRuntimeError,
  cancelDocument,
  createCreditNote,
  createDebitNote,
  issueDocument,
};
