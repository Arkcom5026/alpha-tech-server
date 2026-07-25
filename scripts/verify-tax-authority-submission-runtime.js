const assert = require('assert/strict');
const {
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TAX_AUTHORITY_SUBMISSION_EVENT_TYPES,
  TAX_AUTHORITY_SUBMISSION_STATUSES,
  cancelSubmission,
  enqueueSubmission,
  retrySubmission,
} = require('../src/modules/tax');

const baseAggregate = Object.freeze({
  id: 'submission-1',
  taxDocumentId: 'tax-doc-1',
  providerKey: 'mock-authority',
  status: TAX_AUTHORITY_SUBMISSION_STATUSES.DRAFT,
  version: 0,
});

const command = (action, overrides = {}) => ({
  action,
  submissionId: 'submission-1',
  taxDocumentId: 'tax-doc-1',
  providerKey: 'mock-authority',
  expectedVersion: 0,
  commandKey: `${action.toLowerCase()}-submission-1`,
  correlationId: `corr-${action.toLowerCase()}-1`,
  actorEmployeeId: 7,
  occurredAt: new Date('2026-07-26T04:00:00.000Z'),
  reason: 'Runtime verification',
  ...overrides,
});

const verifyEnqueue = () => {
  const transition = enqueueSubmission(
    baseAggregate,
    command(TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE),
  );

  assert.equal(transition.aggregate.status, TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED);
  assert.equal(transition.aggregate.version, 1);
  assert.equal(transition.event.eventType, TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.ENQUEUED);
  assert.equal(transition.event.aggregateVersion, 1);
  assert.equal(transition.event.metadata.commandKey, 'enqueue-submission-1');
};

const verifyRetry = () => {
  const failedAggregate = {
    ...baseAggregate,
    status: TAX_AUTHORITY_SUBMISSION_STATUSES.FAILED,
    version: 2,
  };
  const transition = retrySubmission(
    failedAggregate,
    command(TAX_AUTHORITY_SUBMISSION_ACTIONS.RETRY, { expectedVersion: 2 }),
  );

  assert.equal(transition.aggregate.status, TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED);
  assert.equal(transition.aggregate.version, 3);
  assert.equal(
    transition.event.eventType,
    TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.RETRY_QUEUED,
  );
};

const verifyCancel = () => {
  const queuedAggregate = {
    ...baseAggregate,
    status: TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED,
    version: 1,
  };
  const transition = cancelSubmission(
    queuedAggregate,
    command(TAX_AUTHORITY_SUBMISSION_ACTIONS.CANCEL, { expectedVersion: 1 }),
  );

  assert.equal(
    transition.aggregate.status,
    TAX_AUTHORITY_SUBMISSION_STATUSES.CANCELLED,
  );
  assert.equal(transition.aggregate.version, 2);
  assert.equal(transition.event.eventType, TAX_AUTHORITY_SUBMISSION_EVENT_TYPES.CANCELLED);
};

const verifyGuards = () => {
  assert.throws(
    () =>
      enqueueSubmission(
        { ...baseAggregate, status: TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED },
        command(TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE),
      ),
    (error) => error.code === 'INVALID_TAX_AUTHORITY_SUBMISSION_TRANSITION',
  );

  assert.throws(
    () =>
      enqueueSubmission(
        baseAggregate,
        command(TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE, { expectedVersion: 1 }),
      ),
    (error) => error.code === 'TAX_AUTHORITY_SUBMISSION_VERSION_CONFLICT',
  );

  assert.throws(
    () =>
      enqueueSubmission(
        baseAggregate,
        command(TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE, {
          taxDocumentId: 'tax-doc-other',
        }),
      ),
    (error) => error.code === 'TAX_AUTHORITY_SUBMISSION_TARGET_MISMATCH',
  );
};

verifyEnqueue();
verifyRetry();
verifyCancel();
verifyGuards();
console.log('Tax Authority Submission Runtime: PASS');
