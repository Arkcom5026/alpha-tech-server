class TaxAuthoritySubmissionTransitionError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionTransitionError';
    this.code = code;
    this.details = details;
  }
}

const TAX_AUTHORITY_SUBMISSION_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  QUEUED: 'QUEUED',
  SUBMITTING: 'SUBMITTING',
  FAILED: 'FAILED',
  ACCEPTED: 'ACCEPTED',
  REPORTED: 'REPORTED',
  CANCELLED: 'CANCELLED',
});

const TAX_AUTHORITY_SUBMISSION_EVENT_TYPES = Object.freeze({
  ENQUEUED: 'ENQUEUED',
  CLAIMED: 'CLAIMED',
  RETRY_QUEUED: 'RETRY_QUEUED',
  CANCELLED: 'CANCELLED',
});

const assertStatus = (status, allowedStatuses, action) => {
  if (!allowedStatuses.includes(status)) {
    throw new TaxAuthoritySubmissionTransitionError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_TRANSITION',
      `Cannot ${action} tax authority submission from ${status}`,
      { action, status, allowedStatuses },
    );
  }
};

const assertCanEnqueue = (status) =>
  assertStatus(status, [TAX_AUTHORITY_SUBMISSION_STATUSES.DRAFT], 'enqueue');

const assertCanClaim = (status) =>
  assertStatus(status, [TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED], 'claim');

const assertCanRetry = (status) =>
  assertStatus(status, [TAX_AUTHORITY_SUBMISSION_STATUSES.FAILED], 'retry');

const assertCanCancelSubmission = (status) =>
  assertStatus(
    status,
    [
      TAX_AUTHORITY_SUBMISSION_STATUSES.QUEUED,
      TAX_AUTHORITY_SUBMISSION_STATUSES.FAILED,
    ],
    'cancel',
  );

module.exports = {
  TAX_AUTHORITY_SUBMISSION_EVENT_TYPES,
  TAX_AUTHORITY_SUBMISSION_STATUSES,
  TaxAuthoritySubmissionTransitionError,
  assertCanCancelSubmission,
  assertCanClaim,
  assertCanEnqueue,
  assertCanRetry,
};
