'use strict';

const outputTaxPeriodRepository = require('../repository/outputTaxPeriodRepository');

const WRITABLE_STATUSES = Object.freeze(new Set(['OPEN', 'REOPENED']));

const normalizePositiveInt = (value, fieldName, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code,
      statusCode: 400,
    });
  }
  return parsed;
};

const normalizeDate = (value, fieldName, code) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${fieldName} must be a valid date`), {
      code,
      statusCode: 400,
    });
  }
  return date;
};

const resolvePeriodIdentity = ({ branchId, occurredAt }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedOccurredAt = normalizeDate(
    occurredAt,
    'occurredAt',
    'OUTPUT_TAX_PERIOD_OCCURRED_AT_INVALID',
  );

  return Object.freeze({
    branchId: normalizedBranchId,
    year: normalizedOccurredAt.getFullYear(),
    month: normalizedOccurredAt.getMonth() + 1,
  });
};

const assertPeriodAllowsWrite = async ({ branchId, occurredAt, operation }, tx) => {
  const identity = resolvePeriodIdentity({ branchId, occurredAt });
  const period = await outputTaxPeriodRepository.findByBranchYearMonth(identity, tx);

  if (!period || WRITABLE_STATUSES.has(String(period.status || '').trim().toUpperCase())) {
    return Object.freeze({ allowed: true, period: period || null, identity });
  }

  const error = Object.assign(
    new Error(`Output tax period ${identity.year}-${String(identity.month).padStart(2, '0')} is locked`),
    {
      code: 'OUTPUT_TAX_PERIOD_LOCKED',
      statusCode: 409,
      details: {
        operation: String(operation || 'WRITE'),
        periodId: period.id,
        status: period.status,
        branchId: identity.branchId,
        year: identity.year,
        month: identity.month,
      },
    },
  );
  throw error;
};

const assertPeriodAllowsIssue = (input, tx) => assertPeriodAllowsWrite({ ...input, operation: 'ISSUE' }, tx);
const assertPeriodAllowsCancel = (input, tx) => assertPeriodAllowsWrite({ ...input, operation: 'CANCEL' }, tx);
const assertPeriodAllowsReplace = (input, tx) => assertPeriodAllowsWrite({ ...input, operation: 'REPLACE' }, tx);
const assertPeriodAllowsTransition = (input, tx) => assertPeriodAllowsWrite({ ...input, operation: 'TRANSITION' }, tx);
const assertPeriodAllowsCreate = (input, tx) => assertPeriodAllowsWrite({ ...input, operation: 'CREATE' }, tx);

module.exports = Object.freeze({
  assertPeriodAllowsWrite,
  assertPeriodAllowsCreate,
  assertPeriodAllowsIssue,
  assertPeriodAllowsCancel,
  assertPeriodAllowsReplace,
  assertPeriodAllowsTransition,
});
