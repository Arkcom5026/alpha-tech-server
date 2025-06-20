// routes/branchRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} = require('../controllers/branchController');

// ✅ GET all branches
router.get('/', getAllBranches);

// ✅ GET branch by ID
router.get('/:id', getBranchById);

// ✅ CREATE new branch
router.post('/', createBranch);

// ✅ UPDATE branch by ID
router.put('/:id', updateBranch);

// ✅ DELETE branch by ID
router.delete('/:id', deleteBranch);

module.exports = router;
