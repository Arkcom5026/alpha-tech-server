'use strict';

const express = require('express');
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} = require('../controllers/branchController');

const router = express.Router();

router.get('/', getAllBranches);
router.get('/:id', getBranchById);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

module.exports = router;
