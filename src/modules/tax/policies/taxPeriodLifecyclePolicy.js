const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const TAX_PERIOD_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
  SUBMITTED: 'SUBMITTED',
  REOPENED: 'REOPENED',
});

const TAX_PERIOD_TRANSITIONS = Object.freeze({
  OPEN: Object.freeze(['CLOSED']),
  CLOSED: Object.freeze(['LOCKED', 'REOPENED']),
  REOPENED: Object.freeze(['CLOSED']),
  LOCKED: Object.freeze(['SUBMITTED']),
  SUBMITTED: Object.freeze([]),
});

const requireLifecycleDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_LIFECYCLE_DATE',
      'Tax period lifecycle transition requires a valid occurredAt date',
    );
  }
  return date;
};

const normalizeTaxPeriodLifecycleCommand = ({
  taxPeriodId,
  branchId,
  targetStatus,
  occurredAt = new Date(),
}) => {
  if (!taxPeriodId || typeof taxPeriodId !== 'string') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ID',
      'Tax period lifecycle transition requires taxPeriodId',
    );
  }
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_BRANCH',
      'Tax period lifecycle transition requires a positive branchId',
    );
  }
  if (!Object.values(TAX_PERIOD_STATUSES).includes(targetStatus)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_TARGET_STATUS',
      'Tax period lifecycle transition target status is invalid',
      { targetStatus },
    );
  }

  return Object.freeze({
    taxPeriodId,
    branchId,
    targetStatus,
    occurredAt: requireLifecycleDate(occurredAt),
  });
};

const assertTaxPeriodTransition = ({ currentStatus, targetStatus }) => {
  if (currentStatus === targetStatus) {
    return Object.freeze({ replayed: true });
  }
  const allowed = TAX_PERIOD_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_TRANSITION_FORBIDDEN',
      `Tax period cannot transition from ${currentStatus} to ${targetStatus}`,
      { currentStatus, targetStatus },
    );
  }
  return Object.freeze({ replayed: false });
};

const buildTaxPeriodLifecycleUpdate = ({ targetStatus, occurredAt }) => {
  const data = { status: targetStatus };
  if (targetStatus === TAX_PERIOD_STATUSES.CLOSED) data.closedAt = occurredAt;
  if (targetStatus === TAX_PERIOD_STATUSES.LOCKED) data.lockedAt = occurredAt;
  if (targetStatus === TAX_PERIOD_STATUSES.SUBMITTED) data.submittedAt = occurredAt;
  if (targetStatus === TAX_PERIOD_STATUSES.REOPENED) data.reopenedAt = occurredAt;
  return Object.freeze(data);
};

module.exports = {
  TAX_PERIOD_STATUSES,
  TAX_PERIOD_TRANSITIONS,
  assertTaxPeriodTransition,
  buildTaxPeriodLifecycleUpdate,
  normalizeTaxPeriodLifecycleCommand,
};