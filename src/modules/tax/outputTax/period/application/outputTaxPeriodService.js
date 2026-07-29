'use strict';

const { prisma } = require('../../../../../../lib/prisma');
const outputTaxPeriodRepository = require('../repository/outputTaxPeriodRepository');

const PERIOD_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

const EVENT_TYPE = Object.freeze({
  CREATED: 'CREATED',
  CLOSE_REQUESTED: 'CLOSE_REQUESTED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

const fail = (message, code, statusCode = 400, details = undefined) => {
  const error = Object.assign(new Error(message), { code, statusCode });
  if (details !== undefined) error.details = details;
  throw error;
};

const requirePositiveInt = (value, fieldName, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${fieldName} must be a positive integer`, code, 400);
  }
  return parsed;
};

const requireYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    fail('year must be an integer between 2000 and 2200', 'OUTPUT_TAX_PERIOD_YEAR_INVALID', 400);
  }
  return year;
};

const requireMonth = (value) => {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    fail('month must be an integer between 1 and 12', 'OUTPUT_TAX_PERIOD_MONTH_INVALID', 400);
  }
  return month;
};

const requireReason = (value, code) => {
  const reason = String(value || '').trim();
  if (!reason) fail('reason is required', code, 400);
  return reason;
};

const normalizeActorEmployeeId = (value) =>
  requirePositiveInt(value, 'actorEmployeeId', 'OUTPUT_TAX_PERIOD_ACTOR_REQUIRED');

const assertPeriodExists = (period) => {
  if (!period) fail('Output tax period not found', 'OUTPUT_TAX_PERIOD_NOT_FOUND', 404);
  return period;
};

const assertTransitionResult = (period) => {
  if (!period) {
    fail(
      'Output tax period changed concurrently or is no longer in the expected status',
      'OUTPUT_TAX_PERIOD_CONFLICT',
      409,
    );
  }
  return period;
};

const buildEventSnapshot = (period) => ({
  branchId: period.branchId,
  year: period.year,
  month: period.month,
  status: period.status,
  currency: period.currency,
  documentCount: period.documentCount,
  activeDocumentCount: period.activeDocumentCount,
  cancelledDocumentCount: period.cancelledDocumentCount,
  subtotalAmount: period.subtotalAmount,
  taxAmount: period.taxAmount,
  totalAmount: period.totalAmount,
  version: period.version,
  periodSnapshot: period.snapshot || {},
});

const createPeriod = async ({ branchId, year, month, currency = 'THB', summary = {}, snapshot = {} }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedYear = requireYear(year);
  const normalizedMonth = requireMonth(month);

  return prisma.$transaction(async (tx) => {
    const existing = await outputTaxPeriodRepository.findByBranchYearMonth(
      { branchId: normalizedBranchId, year: normalizedYear, month: normalizedMonth },
      tx,
    );
    if (existing) return existing;

    const created = await outputTaxPeriodRepository.create(
      {
        branchId: normalizedBranchId,
        year: normalizedYear,
        month: normalizedMonth,
        currency,
        documentCount: summary.documentCount || 0,
        activeDocumentCount: summary.activeDocumentCount || 0,
        cancelledDocumentCount: summary.cancelledDocumentCount || 0,
        subtotalAmount: summary.subtotalAmount || 0,
        taxAmount: summary.taxAmount || 0,
        totalAmount: summary.totalAmount || 0,
        snapshot,
      },
      tx,
    );

    await outputTaxPeriodRepository.appendEvent(
      {
        outputTaxPeriodId: created.id,
        eventType: EVENT_TYPE.CREATED,
        fromStatus: null,
        toStatus: PERIOD_STATUS.OPEN,
        periodVersion: created.version,
        snapshot: buildEventSnapshot(created),
      },
      tx,
    );

    return created;
  });
};

const requestClosePeriod = async ({ branchId, outputTaxPeriodId, expectedVersion, actorEmployeeId, reason }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedPeriodId = requirePositiveInt(
    outputTaxPeriodId,
    'outputTaxPeriodId',
    'OUTPUT_TAX_PERIOD_ID_REQUIRED',
  );
  const normalizedVersion = requirePositiveInt(
    expectedVersion,
    'expectedVersion',
    'OUTPUT_TAX_PERIOD_VERSION_REQUIRED',
  );
  const normalizedActorId = normalizeActorEmployeeId(actorEmployeeId);
  const normalizedReason = requireReason(reason, 'OUTPUT_TAX_PERIOD_CLOSE_REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const current = assertPeriodExists(
      await outputTaxPeriodRepository.findByIdForUpdate(
        { branchId: normalizedBranchId, outputTaxPeriodId: normalizedPeriodId },
        tx,
      ),
    );

    if (![PERIOD_STATUS.OPEN, PERIOD_STATUS.REOPENED].includes(current.status)) {
      fail('Only OPEN or REOPENED periods can request close', 'OUTPUT_TAX_PERIOD_CLOSE_REQUEST_NOT_ALLOWED', 409);
    }

    const transitioned = assertTransitionResult(
      await outputTaxPeriodRepository.transitionStatus(
        {
          branchId: normalizedBranchId,
          outputTaxPeriodId: normalizedPeriodId,
          expectedStatus: current.status,
          targetStatus: PERIOD_STATUS.CLOSING,
          expectedVersion: normalizedVersion,
          actorEmployeeId: normalizedActorId,
          reason: normalizedReason,
        },
        tx,
      ),
    );

    await outputTaxPeriodRepository.appendEvent(
      {
        outputTaxPeriodId: transitioned.id,
        eventType: EVENT_TYPE.CLOSE_REQUESTED,
        fromStatus: current.status,
        toStatus: transitioned.status,
        reason: normalizedReason,
        actorEmployeeId: normalizedActorId,
        periodVersion: transitioned.version,
        snapshot: buildEventSnapshot(transitioned),
      },
      tx,
    );

    return transitioned;
  });
};

const closePeriod = async ({ branchId, outputTaxPeriodId, expectedVersion, actorEmployeeId, reason }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedPeriodId = requirePositiveInt(
    outputTaxPeriodId,
    'outputTaxPeriodId',
    'OUTPUT_TAX_PERIOD_ID_REQUIRED',
  );
  const normalizedVersion = requirePositiveInt(
    expectedVersion,
    'expectedVersion',
    'OUTPUT_TAX_PERIOD_VERSION_REQUIRED',
  );
  const normalizedActorId = normalizeActorEmployeeId(actorEmployeeId);
  const normalizedReason = requireReason(reason, 'OUTPUT_TAX_PERIOD_CLOSE_REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const current = assertPeriodExists(
      await outputTaxPeriodRepository.findByIdForUpdate(
        { branchId: normalizedBranchId, outputTaxPeriodId: normalizedPeriodId },
        tx,
      ),
    );

    if (current.status !== PERIOD_STATUS.CLOSING) {
      fail('Only CLOSING periods can be closed', 'OUTPUT_TAX_PERIOD_CLOSE_NOT_ALLOWED', 409);
    }

    const transitioned = assertTransitionResult(
      await outputTaxPeriodRepository.transitionStatus(
        {
          branchId: normalizedBranchId,
          outputTaxPeriodId: normalizedPeriodId,
          expectedStatus: PERIOD_STATUS.CLOSING,
          targetStatus: PERIOD_STATUS.CLOSED,
          expectedVersion: normalizedVersion,
          actorEmployeeId: normalizedActorId,
          reason: normalizedReason,
        },
        tx,
      ),
    );

    await outputTaxPeriodRepository.appendEvent(
      {
        outputTaxPeriodId: transitioned.id,
        eventType: EVENT_TYPE.CLOSED,
        fromStatus: current.status,
        toStatus: transitioned.status,
        reason: normalizedReason,
        actorEmployeeId: normalizedActorId,
        periodVersion: transitioned.version,
        snapshot: buildEventSnapshot(transitioned),
      },
      tx,
    );

    return transitioned;
  });
};

const reopenPeriod = async ({ branchId, outputTaxPeriodId, expectedVersion, actorEmployeeId, reason }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedPeriodId = requirePositiveInt(
    outputTaxPeriodId,
    'outputTaxPeriodId',
    'OUTPUT_TAX_PERIOD_ID_REQUIRED',
  );
  const normalizedVersion = requirePositiveInt(
    expectedVersion,
    'expectedVersion',
    'OUTPUT_TAX_PERIOD_VERSION_REQUIRED',
  );
  const normalizedActorId = normalizeActorEmployeeId(actorEmployeeId);
  const normalizedReason = requireReason(reason, 'OUTPUT_TAX_PERIOD_REOPEN_REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const current = assertPeriodExists(
      await outputTaxPeriodRepository.findByIdForUpdate(
        { branchId: normalizedBranchId, outputTaxPeriodId: normalizedPeriodId },
        tx,
      ),
    );

    if (current.status !== PERIOD_STATUS.CLOSED) {
      fail('Only CLOSED periods can be reopened', 'OUTPUT_TAX_PERIOD_REOPEN_NOT_ALLOWED', 409);
    }

    const transitioned = assertTransitionResult(
      await outputTaxPeriodRepository.transitionStatus(
        {
          branchId: normalizedBranchId,
          outputTaxPeriodId: normalizedPeriodId,
          expectedStatus: PERIOD_STATUS.CLOSED,
          targetStatus: PERIOD_STATUS.REOPENED,
          expectedVersion: normalizedVersion,
          actorEmployeeId: normalizedActorId,
          reason: normalizedReason,
        },
        tx,
      ),
    );

    await outputTaxPeriodRepository.appendEvent(
      {
        outputTaxPeriodId: transitioned.id,
        eventType: EVENT_TYPE.REOPENED,
        fromStatus: current.status,
        toStatus: transitioned.status,
        reason: normalizedReason,
        actorEmployeeId: normalizedActorId,
        periodVersion: transitioned.version,
        snapshot: buildEventSnapshot(transitioned),
      },
      tx,
    );

    return transitioned;
  });
};

const getPeriod = async ({ branchId, outputTaxPeriodId }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedPeriodId = requirePositiveInt(
    outputTaxPeriodId,
    'outputTaxPeriodId',
    'OUTPUT_TAX_PERIOD_ID_REQUIRED',
  );
  return assertPeriodExists(
    await outputTaxPeriodRepository.findById({
      branchId: normalizedBranchId,
      outputTaxPeriodId: normalizedPeriodId,
    }),
  );
};

const getPeriodTimeline = async ({ branchId, outputTaxPeriodId }) => {
  const period = await getPeriod({ branchId, outputTaxPeriodId });
  const events = await outputTaxPeriodRepository.listEvents({ outputTaxPeriodId: period.id });
  return Object.freeze({ period, events: Object.freeze(events) });
};

const listPeriods = async ({ branchId, status = null, year = null, limit = 50, offset = 0 }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'branchId', 'TAX_BRANCH_REQUIRED');
  const normalizedYear = year == null ? null : requireYear(year);
  return outputTaxPeriodRepository.list({
    branchId: normalizedBranchId,
    status,
    year: normalizedYear,
    limit,
    offset,
  });
};

module.exports = Object.freeze({
  PERIOD_STATUS,
  EVENT_TYPE,
  createPeriod,
  requestClosePeriod,
  closePeriod,
  reopenPeriod,
  getPeriod,
  getPeriodTimeline,
  listPeriods,
});