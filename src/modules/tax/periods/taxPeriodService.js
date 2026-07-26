const repository = require('./taxPeriodRepository');

const TRANSITIONS = {
  OPEN: ['CLOSED'],
  REOPENED: ['CLOSED'],
  CLOSED: ['LOCKED', 'REOPENED'],
  LOCKED: ['SUBMITTED', 'REOPENED'],
  SUBMITTED: ['REOPENED'],
};

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const normalizeBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    fail('TAX_PERIOD_BRANCH_REQUIRED', 'branchId must be a positive integer');
  }
  return branchId;
};

const monthBoundary = (referenceDate) => {
  const date = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(date.getTime())) fail('TAX_PERIOD_INVALID_DATE', 'referenceDate is invalid');
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    periodCode: `${year}-${String(month + 1).padStart(2, '0')}`,
    startDate: new Date(Date.UTC(year, month, 1)),
    endDate: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
};

const ensureMonthlyPeriod = async ({ branchId, referenceDate }) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  const boundary = monthBoundary(referenceDate);
  const before = await repository.list({ branchId: normalizedBranchId });
  const existing = before.find((period) => period.periodCode === boundary.periodCode);
  if (existing) return { created: false, period: existing };
  const period = await repository.createMonthly({ branchId: normalizedBranchId, ...boundary });
  return { created: true, period };
};

const listPeriods = async ({ branchId, status, fromDate, toDate }) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  const normalizedStatus = status ? String(status).trim().toUpperCase() : undefined;
  if (normalizedStatus && !repository.STATUS_VALUES.includes(normalizedStatus)) {
    fail('TAX_PERIOD_INVALID_STATUS', 'Unsupported tax period status');
  }
  if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
    fail('TAX_PERIOD_INVALID_DATE_RANGE', 'fromDate must not be after toDate');
  }
  const periods = await repository.list({
    branchId: normalizedBranchId,
    status: normalizedStatus,
    fromDate,
    toDate,
  });
  return { periods, total: periods.length };
};

const getPeriodDetail = async ({ branchId, taxPeriodId }) => {
  const period = await repository.findById({
    branchId: normalizeBranchId(branchId),
    taxPeriodId,
  });
  if (!period) fail('TAX_PERIOD_NOT_FOUND', 'Tax period not found', 404);
  return period;
};

const getPeriodSummary = async ({ branchId, referenceDate }) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  const periods = await repository.list({ branchId: normalizedBranchId });
  const boundary = monthBoundary(referenceDate);
  const countsByStatus = periods.reduce((counts, period) => {
    counts[period.status] = (counts[period.status] || 0) + 1;
    return counts;
  }, {});
  return {
    total: periods.length,
    countsByStatus,
    currentPeriod: periods.find((period) => period.periodCode === boundary.periodCode) || null,
  };
};

const transitionPeriod = async ({ branchId, taxPeriodId, targetStatus, occurredAt }) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  const current = await getPeriodDetail({ branchId: normalizedBranchId, taxPeriodId });
  if (current.status === targetStatus) return { replayed: true, period: current };
  if (!(TRANSITIONS[current.status] || []).includes(targetStatus)) {
    fail('TAX_PERIOD_TRANSITION_FORBIDDEN', `Cannot transition ${current.status} to ${targetStatus}`, 409);
  }
  const period = await repository.transition({
    branchId: normalizedBranchId,
    taxPeriodId,
    targetStatus,
    occurredAt,
  });
  if (!period) fail('TAX_PERIOD_NOT_FOUND', 'Tax period not found', 404);
  return { replayed: false, period };
};

module.exports = {
  ensureMonthlyPeriod,
  getPeriodDetail,
  getPeriodSummary,
  listPeriods,
  transitionPeriod,
};