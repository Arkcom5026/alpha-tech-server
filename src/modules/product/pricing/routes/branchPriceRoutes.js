// src/modules/product/pricing/routes/branchPriceRoutes.js

const express = require('express');
const router = express.Router();

const {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
} = require('../runtime/branchPriceRuntimeController');
const { getBranchBySlug } = require('../../../branch/runtime/branchRuntimeController');
const verifyToken = require('../../../../../middlewares/verifyToken');

router.use(verifyToken);

router.get('/me/:productId', getActiveBranchPrice);
router.post('/', upsertBranchPrice);
router.get('/by-branch', getBranchPricesByBranch);
router.get('/all-products', getAllProductsWithBranchPrice);
router.put('/bulk-update', updateMultipleBranchPrices);
router.get('/profile-by-slug/:slug', getBranchBySlug);

module.exports = router;
