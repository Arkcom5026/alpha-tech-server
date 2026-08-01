const { CANDIDATE_STATUS } = require('../../contracts/missingCostResolutionContract');

const TRANSITION_EVENT_TYPE = Object.freeze({
  [CANDIDATE_STATUS.SUBMITTED]: 'SUBMITTED',
  [CANDIDATE_STATUS.APPROVED]: 'APPROVED',
  [CANDIDATE_STATUS.REJECTED]: 'REJECTED',
  [CANDIDATE_STATUS.RETURNED_FOR_CORRECTION]: 'RETURNED_FOR_CORRECTION',
  [CANDIDATE_STATUS.CANCELLED]: 'CANCELLED',
  [CANDIDATE_STATUS.SUPERSEDED]: 'SUPERSEDED',
});

const createError = (code, message, statusCode = 400, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

const assertPositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createError('MISSING_COST_MUTATION_INVALID_IDENTITY', `${field} must be a positive integer`, 400, { field, value });
  }
  return normalized;
};

const assertExpectedAuthority = ({ resolution, branchId, expectedStatus, expectedVersion, expectedSnapshotHash }) => {
  if (!resolution || Number(resolution.branchId) !== Number(branchId)) {
    throw createError('MISSING_COST_RESOLUTION_NOT_FOUND', 'Missing cost resolution not found', 404);
  }
  if (expectedStatus && String(resolution.status) !== String(expectedStatus)) {
    throw createError('MISSING_COST_RESOLUTION_STALE_STATUS', 'Missing cost resolution status is stale', 409, {
      expectedStatus,
      actualStatus: resolution.status,
    });
  }
  if (expectedVersion != null && Number(resolution.currentVersion) !== Number(expectedVersion)) {
    throw createError('MISSING_COST_RESOLUTION_STALE_VERSION', 'Missing cost resolution version is stale', 409, {
      expectedVersion: Number(expectedVersion),
      actualVersion: Number(resolution.currentVersion),
    });
  }
  if (expectedSnapshotHash && resolution.sourceSnapshotHash !== expectedSnapshotHash) {
    throw createError('MISSING_COST_RESOLUTION_STALE_SNAPSHOT', 'Missing cost resolution snapshot is stale', 409);
  }
};

const assertSeparateApprover = ({ resolution, actorEmployeeId, toStatus }) => {
  if (String(toStatus) !== CANDIDATE_STATUS.APPROVED) return;
  if (Number(resolution.createdByEmployeeId) === Number(actorEmployeeId)) {
    throw createError('MISSING_COST_RESOLUTION_SELF_APPROVAL_FORBIDDEN', 'Creator cannot approve the same missing cost resolution', 403);
  }
};

const assertTransitionEventType = (toStatus) => {
  const eventType = TRANSITION_EVENT_TYPE[String(toStatus)];
  if (!eventType) {
    throw createError('MISSING_COST_RESOLUTION_INVALID_TRANSITION', 'Unsupported missing cost resolution transition', 409, { toStatus });
  }
  return eventType;
};

module.exports = {
  TRANSITION_EVENT_TYPE,
  assertPositiveInteger,
  assertExpectedAuthority,
  assertSeparateApprover,
  assertTransitionEventType,
  createError,
};
