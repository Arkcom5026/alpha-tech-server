const express = require('express');
const accountantWorkspaceRoutes = require('../accountant-workspace');
const taxReviewRoutes = require('../tax-review-collaboration');

const router = express.Router();

router.use(accountantWorkspaceRoutes);
router.use(taxReviewRoutes);

module.exports = router;
