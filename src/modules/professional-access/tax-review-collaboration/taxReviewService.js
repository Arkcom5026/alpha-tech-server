const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, message) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) fail(code, message);
  return normalized;
};

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

const assertAuthority = async ({ repository, userId, externalOrganizationId, businessId, action, now }) => {
  const membership = await repository.findActiveMembership({ userId, externalOrganizationId });
  if (!membership) {
    fail('TAX_REVIEW_MEMBERSHIP_REQUIRED', 'Active accounting-firm membership is required', 403);
  }

  const assignment = await repository.findActiveAssignment({ externalOrganizationId, businessId, now });
  if (!assignment) {
    fail('TAX_REVIEW_ASSIGNMENT_REQUIRED', 'Active business assignment is required', 403);
  }

  const allowed = assignment.permissionScopes.some((scope) => scope.actions.includes(action));
  if (!allowed) {
    fail('TAX_REVIEW_PERMISSION_DENIED', `TAX_REVIEW ${action} permission is required`, 403);
  }

  return { assignment, membership };
};

const listReviews = async ({ repository, userId, externalOrganizationId, businessId, branchId, status, now = new Date() }) => {
  const ids = {
    userId: positiveInt(userId, 'TAX_REVIEW_USER_REQUIRED', 'userId is required'),
    externalOrganizationId: positiveInt(externalOrganizationId, 'TAX_REVIEW_ORGANIZATION_REQUIRED', 'externalOrganizationId is required'),
    businessId: positiveInt(businessId, 'TAX_REVIEW_BUSINESS_REQUIRED', 'businessId is required'),
  };
  const normalizedBranchId = branchId ? positiveInt(branchId, 'TAX_REVIEW_BRANCH_INVALID', 'branchId must be positive') : undefined;
  const normalizedStatus = status ? normalizeStatus(status) : undefined;
  const { assignment } = await assertAuthority({ repository, ...ids, action: 'READ', now });
  return repository.listReviews({ assignmentId: assignment.id, branchId: normalizedBranchId, status: normalizedStatus });
};

const createReview = async ({ repository, userId, externalOrganizationId, businessId, branchId, taxPeriodCode, title, now = new Date() }) => {
  const ids = {
    userId: positiveInt(userId, 'TAX_REVIEW_USER_REQUIRED', 'userId is required'),
    externalOrganizationId: positiveInt(externalOrganizationId, 'TAX_REVIEW_ORGANIZATION_REQUIRED', 'externalOrganizationId is required'),
    businessId: positiveInt(businessId, 'TAX_REVIEW_BUSINESS_REQUIRED', 'businessId is required'),
  };
  const normalizedBranchId = positiveInt(branchId, 'TAX_REVIEW_BRANCH_REQUIRED', 'branchId is required');
  const normalizedPeriod = String(taxPeriodCode || '').trim();
  const normalizedTitle = String(title || '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalizedPeriod)) fail('TAX_REVIEW_PERIOD_INVALID', 'taxPeriodCode must use YYYY-MM');
  if (!normalizedTitle) fail('TAX_REVIEW_TITLE_REQUIRED', 'title is required');

  const { assignment } = await assertAuthority({ repository, ...ids, action: 'COMMENT', now });
  return repository.createReview({
    assignmentId: assignment.id,
    businessId: ids.businessId,
    branchId: normalizedBranchId,
    taxPeriodCode: normalizedPeriod,
    title: normalizedTitle,
    status: 'OPEN',
    openedByUserId: ids.userId,
  });
};

const addNote = async ({ repository, userId, externalOrganizationId, businessId, reviewId, message, now = new Date() }) => {
  const ids = {
    userId: positiveInt(userId, 'TAX_REVIEW_USER_REQUIRED', 'userId is required'),
    externalOrganizationId: positiveInt(externalOrganizationId, 'TAX_REVIEW_ORGANIZATION_REQUIRED', 'externalOrganizationId is required'),
    businessId: positiveInt(businessId, 'TAX_REVIEW_BUSINESS_REQUIRED', 'businessId is required'),
    reviewId: positiveInt(reviewId, 'TAX_REVIEW_ID_REQUIRED', 'reviewId is required'),
  };
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) fail('TAX_REVIEW_NOTE_REQUIRED', 'message is required');

  const { assignment } = await assertAuthority({ repository, ...ids, action: 'COMMENT', now });
  const review = await repository.findReview({ id: ids.reviewId, assignmentId: assignment.id });
  if (!review) fail('TAX_REVIEW_NOT_FOUND', 'Tax review session not found', 404);
  if (review.status === 'RESOLVED') fail('TAX_REVIEW_ALREADY_RESOLVED', 'Resolved review cannot receive notes', 409);

  return repository.addNote({ reviewSessionId: ids.reviewId, authorUserId: ids.userId, message: normalizedMessage });
};

const resolveReview = async ({ repository, userId, externalOrganizationId, businessId, reviewId, now = new Date() }) => {
  const ids = {
    userId: positiveInt(userId, 'TAX_REVIEW_USER_REQUIRED', 'userId is required'),
    externalOrganizationId: positiveInt(externalOrganizationId, 'TAX_REVIEW_ORGANIZATION_REQUIRED', 'externalOrganizationId is required'),
    businessId: positiveInt(businessId, 'TAX_REVIEW_BUSINESS_REQUIRED', 'businessId is required'),
    reviewId: positiveInt(reviewId, 'TAX_REVIEW_ID_REQUIRED', 'reviewId is required'),
  };
  const { assignment } = await assertAuthority({ repository, ...ids, action: 'RESOLVE', now });
  const review = await repository.findReview({ id: ids.reviewId, assignmentId: assignment.id });
  if (!review) fail('TAX_REVIEW_NOT_FOUND', 'Tax review session not found', 404);
  if (review.status === 'RESOLVED') return { replayed: true, review };

  await repository.updateStatus({
    id: ids.reviewId,
    assignmentId: assignment.id,
    status: 'RESOLVED',
    resolvedAt: now,
    resolvedByUserId: ids.userId,
  });
  return {
    replayed: false,
    review: await repository.findReview({ id: ids.reviewId, assignmentId: assignment.id }),
  };
};

module.exports = { addNote, createReview, listReviews, resolveReview };
