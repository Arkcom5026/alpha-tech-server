const {
  authorizeProfessionalAccess,
  fail,
  normalizePositiveInt,
  normalizeToken,
} = require('../shared/professionalAccessAuthority');

const authorizeTaxReview = ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  branchId,
  action,
  now,
}) =>
  authorizeProfessionalAccess({
    repository,
    userId,
    externalOrganizationId,
    businessId,
    branchId,
    resource: 'TAX_REVIEW',
    action,
    now,
    codePrefix: 'TAX_REVIEW',
  });

const listReviews = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  branchId,
  status,
  now = new Date(),
}) => {
  const normalizedBranchId = branchId
    ? normalizePositiveInt(branchId, 'TAX_REVIEW_BRANCH_INVALID', 'branchId must be positive')
    : undefined;
  const normalizedStatus = status ? normalizeToken(status) : undefined;
  const { assignment } = await authorizeTaxReview({
    repository,
    userId,
    externalOrganizationId,
    businessId,
    branchId: normalizedBranchId,
    action: 'READ',
    now,
  });
  return repository.listReviews({
    assignmentId: assignment.id,
    branchId: normalizedBranchId,
    status: normalizedStatus,
  });
};

const createReview = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  branchId,
  taxPeriodCode,
  title,
  now = new Date(),
}) => {
  const normalizedBranchId = normalizePositiveInt(
    branchId,
    'TAX_REVIEW_BRANCH_REQUIRED',
    'branchId is required',
  );
  const normalizedPeriod = String(taxPeriodCode || '').trim();
  const normalizedTitle = String(title || '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalizedPeriod)) {
    fail('TAX_REVIEW_PERIOD_INVALID', 'taxPeriodCode must use YYYY-MM');
  }
  if (!normalizedTitle) fail('TAX_REVIEW_TITLE_REQUIRED', 'title is required');

  const { ids, assignment } = await authorizeTaxReview({
    repository,
    userId,
    externalOrganizationId,
    businessId,
    branchId: normalizedBranchId,
    action: 'COMMENT',
    now,
  });
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

const addNote = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  reviewId,
  message,
  now = new Date(),
}) => {
  const normalizedReviewId = normalizePositiveInt(
    reviewId,
    'TAX_REVIEW_ID_REQUIRED',
    'reviewId is required',
  );
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) fail('TAX_REVIEW_NOTE_REQUIRED', 'message is required');

  const { ids, assignment } = await authorizeTaxReview({
    repository,
    userId,
    externalOrganizationId,
    businessId,
    action: 'COMMENT',
    now,
  });
  const review = await repository.findReview({ id: normalizedReviewId, assignmentId: assignment.id });
  if (!review) fail('TAX_REVIEW_NOT_FOUND', 'Tax review session not found', 404);
  if (review.status === 'RESOLVED') {
    fail('TAX_REVIEW_ALREADY_RESOLVED', 'Resolved review cannot receive notes', 409);
  }

  return repository.addNote({
    reviewSessionId: normalizedReviewId,
    authorUserId: ids.userId,
    message: normalizedMessage,
  });
};

const resolveReview = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  reviewId,
  now = new Date(),
}) => {
  const normalizedReviewId = normalizePositiveInt(
    reviewId,
    'TAX_REVIEW_ID_REQUIRED',
    'reviewId is required',
  );
  const { ids, assignment } = await authorizeTaxReview({
    repository,
    userId,
    externalOrganizationId,
    businessId,
    action: 'RESOLVE',
    now,
  });
  const review = await repository.findReview({ id: normalizedReviewId, assignmentId: assignment.id });
  if (!review) fail('TAX_REVIEW_NOT_FOUND', 'Tax review session not found', 404);
  if (review.status === 'RESOLVED') return { replayed: true, review };

  await repository.updateStatus({
    id: normalizedReviewId,
    assignmentId: assignment.id,
    status: 'RESOLVED',
    resolvedAt: now,
    resolvedByUserId: ids.userId,
  });
  return {
    replayed: false,
    review: await repository.findReview({ id: normalizedReviewId, assignmentId: assignment.id }),
  };
};

module.exports = { addNote, createReview, listReviews, resolveReview };
