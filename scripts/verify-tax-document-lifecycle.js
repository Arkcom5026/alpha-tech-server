const assert = require('node:assert/strict');
const {
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TAX_DOCUMENT_STATUSES,
  cancelDocument,
  createCreditNote,
  createDebitNote,
  issueDocument,
} = require('../src/modules/tax');

const occurredAt = new Date('2026-07-25T10:00:00.000Z');

const createAggregate = (overrides = {}) => ({
  id: 'tax-document-101',
  status: TAX_DOCUMENT_STATUSES.DRAFT,
  version: 1,
  ...overrides,
});

const createCommand = (action, overrides = {}) => ({
  action,
  taxDocumentId: 'tax-document-101',
  expectedVersion: 1,
  commandKey: `tax-document-101:${action}:1`,
  correlationId: 'sale-501',
  actorEmployeeId: 7,
  occurredAt,
  ...overrides,
});

const expectCode = (fn, code) => {
  assert.throws(fn, (error) => {
    assert.equal(error.code, code);
    return true;
  });
};

const verifyIssueTransition = () => {
  const result = issueDocument(
    createAggregate(),
    createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE),
  );

  assert.equal(result.aggregate.status, TAX_DOCUMENT_STATUSES.ISSUED);
  assert.equal(result.aggregate.version, 2);
  assert.equal(result.event.eventType, 'ISSUED');
  assert.equal(result.event.aggregateVersion, 2);
  assert.equal(result.event.metadata.commandKey, 'tax-document-101:ISSUE:1');
  assert.equal(result.event.occurredAt, occurredAt);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.aggregate), true);
  assert.equal(Object.isFrozen(result.event), true);
};

const verifyInvalidTransitions = () => {
  expectCode(
    () =>
      issueDocument(
        createAggregate({ status: TAX_DOCUMENT_STATUSES.ISSUED }),
        createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE),
      ),
    'TAX_DOCUMENT_CANNOT_BE_ISSUED',
  );

  expectCode(
    () =>
      cancelDocument(
        createAggregate(),
        createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.CANCEL),
      ),
    'TAX_DOCUMENT_CANNOT_BE_CANCELLED',
  );

  expectCode(
    () =>
      cancelDocument(
        createAggregate({ status: TAX_DOCUMENT_STATUSES.CANCELLED }),
        createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.CANCEL),
      ),
    'TAX_DOCUMENT_CANNOT_BE_CANCELLED',
  );
};

const verifyCancelTransition = () => {
  const aggregate = createAggregate({
    status: TAX_DOCUMENT_STATUSES.ISSUED,
    version: 2,
  });
  const command = createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.CANCEL, {
    expectedVersion: 2,
    commandKey: 'tax-document-101:CANCEL:2',
    reason: 'CUSTOMER_REQUEST',
  });
  const result = cancelDocument(aggregate, command);

  assert.equal(result.aggregate.status, TAX_DOCUMENT_STATUSES.CANCELLED);
  assert.equal(result.aggregate.version, 3);
  assert.equal(result.event.eventType, 'CANCELLED');
  assert.equal(result.event.metadata.reason, 'CUSTOMER_REQUEST');
};

const verifyAdjustmentEvents = () => {
  const aggregate = createAggregate({
    status: TAX_DOCUMENT_STATUSES.ISSUED,
    version: 2,
  });

  const credit = createCreditNote(
    aggregate,
    createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_CREDIT_NOTE, {
      expectedVersion: 2,
      commandKey: 'tax-document-101:CREDIT:2',
      relatedTaxDocumentId: 'credit-note-201',
    }),
  );

  assert.equal(credit.aggregate.status, TAX_DOCUMENT_STATUSES.ISSUED);
  assert.equal(credit.aggregate.version, 3);
  assert.equal(credit.event.eventType, 'CREDIT_NOTE_CREATED');
  assert.equal(
    credit.event.metadata.relatedTaxDocumentId,
    'credit-note-201',
  );

  const debit = createDebitNote(
    aggregate,
    createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.CREATE_DEBIT_NOTE, {
      expectedVersion: 2,
      commandKey: 'tax-document-101:DEBIT:2',
      relatedTaxDocumentId: 'debit-note-301',
    }),
  );

  assert.equal(debit.aggregate.status, TAX_DOCUMENT_STATUSES.ISSUED);
  assert.equal(debit.aggregate.version, 3);
  assert.equal(debit.event.eventType, 'DEBIT_NOTE_CREATED');
};

const verifyAuthorityGuards = () => {
  expectCode(
    () =>
      issueDocument(
        createAggregate(),
        createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE, {
          taxDocumentId: 'tax-document-other',
        }),
      ),
    'TAX_DOCUMENT_IDENTITY_MISMATCH',
  );

  expectCode(
    () =>
      issueDocument(
        createAggregate(),
        createCommand(TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE, {
          expectedVersion: 9,
        }),
      ),
    'TAX_DOCUMENT_VERSION_CONFLICT',
  );
};

const run = () => {
  verifyIssueTransition();
  verifyInvalidTransitions();
  verifyCancelTransition();
  verifyAdjustmentEvents();
  verifyAuthorityGuards();
  console.log('Tax Document Lifecycle: PASS');
};

try {
  run();
} catch (error) {
  console.error('Tax Document Lifecycle: FAIL');
  console.error(error);
  process.exitCode = 1;
}
