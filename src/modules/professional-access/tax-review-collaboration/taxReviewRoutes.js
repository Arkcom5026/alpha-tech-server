const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxReviewController');

const router = express.Router();
router.use(verifyToken);

router.get(
  '/organizations/:externalOrganizationId/businesses/:businessId/tax-reviews',
  controller.listReviews,
);
router.post(
  '/organizations/:externalOrganizationId/businesses/:businessId/tax-reviews',
  controller.createReview,
);
router.post(
  '/organizations/:externalOrganizationId/businesses/:businessId/tax-reviews/:reviewId/notes',
  controller.addNote,
);
router.post(
  '/organizations/:externalOrganizationId/businesses/:businessId/tax-reviews/:reviewId/resolve',
  controller.resolveReview,
);

module.exports = router;
