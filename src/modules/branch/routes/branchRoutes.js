// src/modules/branch/routes/branchRoutes.js
const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

const {
  getAllBranches,
  getBranchById,
  getBranchBySlug,
  createBranch,
  updateBranch,
  deleteBranch,
} = require('../runtime/branchRuntimeController');

router.get('/', getAllBranches);
router.get('/profile-by-slug/:slug', getBranchBySlug);
router.get('/:id', getBranchById);

// Branch creation and changes affect tenant boundaries. Keep reads backward-compatible,
// while requiring an authenticated administrator for every mutation.
router.post('/', verifyToken, requireAdmin, createBranch);
router.put('/:id', verifyToken, requireAdmin, updateBranch);
router.delete('/:id', verifyToken, requireAdmin, deleteBranch);

module.exports = router;
