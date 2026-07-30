// src/modules/branch/routes/branchRoutes.js
const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} = require('../../../../controllers/branchController');

router.get('/', getAllBranches);
router.get('/:id', getBranchById);
// Branch creation and changes affect tenant boundaries. Keep reads backward-compatible,
 // while requiring an authenticated administrator for every mutation.
router.post('/', verifyToken, requireAdmin, createBranch);
router.put('/:id', verifyToken, requireAdmin, updateBranch);
router.delete('/:id', verifyToken, requireAdmin, deleteBranch);

module.exports = router;
