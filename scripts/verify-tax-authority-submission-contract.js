const assert = require('assert/strict');
const {
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TaxAuthoritySubmissionContractError,
  normalizeTaxAuthoritySubmissionCommand,
} = require('../src/modules/tax');

const baseCommand = {
  action: TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE,
  submissionId: null,
  taxDocumentId: 'tax-doc-1',
  providerKey: 'REVENUE_DEPARTMENT_SANDBOX',
  expectedVersion: 0,
  commandKey: 'enqueue-tax-doc-1',
  correlationId: 'corr-tax-authority-1',
  actorEmployeeId: 7,
  occurredAt: new Date('2026-07-26T04:00:00.000Z'),
  reason: 'Ready for authority submission',
};

const verifyNormalization = () => {
  const command = normalizeTaxAuthoritySubmissionCommand(
    baseCommand,
    TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE,
  );

  assert.equal(command.action, TAX_AUTHORITY_SUBMISSION_ACTIONS.ENQUEUE);
  assert.equal(command.submissionId, null);
  assert.equal(command.taxDocumentId, 'tax-doc-1');
  assert.equal(command.providerKey, 'REVENUE_DEPARTMENT_SANDBOX');
  assert.equal(command.expectedVersion, 0);
  assert.equal(command.commandKey, 'enqueue-tax-doc-1');
  assert.equal(command.actorEmployeeId, 7);
  assert.equal(command.occurredAt.toISOString(), '2026-07-26T04:00:00.000Z');
  assert.equal(Object.isFrozen(command), true);
};

const verifyRetryAndCancelShapes = () => {
  for (const action of [
    TAX_AUTHORITY_SUBMISSION_ACTIONS.RETRY,
    TAX_AUTHORITY_SUBMISSION_ACTIONS.CANCEL,
  ]) {
    const command = normalizeTaxAuthoritySubmissionCommand({
      ...baseCommand,
      action,
      submissionId: 'submission-1',
      expectedVersion: 2,
      commandKey: `${action.toLowerCase()}-submission-1`,
    });

    assert.equal(command.action, action);
    assert.equal(command.submissionId, 'submission-1');
    assert.equal(command.expectedVersion, 2);
  }
};

const verifyRejections = () => {
  assert.throws(
    () => normalizeTaxAuthoritySubmissionCommand({ ...baseCommand, action: '' }),
    (error) =>
      error instanceof TaxAuthoritySubmissionContractError &&
      error.code === 'INVALID_TAX_AUTHORITY_SUBMISSION_COMMAND',
  );

  assert.throws(
    () =>
      normalizeTaxAuthoritySubmissionCommand({
        ...baseCommand,
        action: 'SUBMIT_NOW',
      }),
    (error) =>
      error instanceof TaxAuthoritySubmissionContractError &&
      error.code === 'UNSUPPORTED_TAX_AUTHORITY_SUBMISSION_ACTION',
  );

  assert.throws(
    () =>
      normalizeTaxAuthoritySubmissionCommand(
        baseCommand,
        TAX_AUTHORITY_SUBMISSION_ACTIONS.RETRY,
      ),
    (error) =>
      error instanceof TaxAuthoritySubmissionContractError &&
      error.code === 'TAX_AUTHORITY_SUBMISSION_ACTION_MISMATCH',
  );
};

const run = () => {
  verifyNormalization();
  verifyRetryAndCancelShapes();
  verifyRejections();
  console.log('Tax Authority Submission Contract: PASS');
};

try {
  run();
} catch (error) {
  console.error('Tax Authority Submission Contract: FAIL');
  console.error(error);
  process.exitCode = 1;
}
