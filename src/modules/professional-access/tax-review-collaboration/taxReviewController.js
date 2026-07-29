const repository = require('./taxReviewRepository');
const service = require('./taxReviewService');

const resolveUserId = (req) => Number(req.user?.id || req.user?.userId || req.user?.sub || 0);

const handle = (operation, successStatus = 200) => async (req, res, next) => {
  try {
    const data = await operation(req);
    return res.status(successStatus).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const listReviews = handle((req) =>
  service.listReviews({
    repository,
    userId: resolveUserId(req),
    externalOrganizationId: req.params.externalOrganizationId,
    businessId: req.params.businessId,
    branchId: req.query.branchId,
    status: req.query.status,
  }),
);

const createReview = handle(
  (req) =>
    service.createReview({
      repository,
      userId: resolveUserId(req),
      externalOrganizationId: req.params.externalOrganizationId,
      businessId: req.params.businessId,
      branchId: req.body?.branchId,
      taxPeriodCode: req.body?.taxPeriodCode,
      title: req.body?.title,
    }),
  201,
);

const addNote = handle(
  (req) =>
    service.addNote({
      repository,
      userId: resolveUserId(req),
      externalOrganizationId: req.params.externalOrganizationId,
      businessId: req.params.businessId,
      reviewId: req.params.reviewId,
      message: req.body?.message,
    }),
  201,
);

const resolveReview = handle((req) =>
  service.resolveReview({
    repository,
    userId: resolveUserId(req),
    externalOrganizationId: req.params.externalOrganizationId,
    businessId: req.params.businessId,
    reviewId: req.params.reviewId,
  }),
);

module.exports = { addNote, createReview, listReviews, resolveReview };
