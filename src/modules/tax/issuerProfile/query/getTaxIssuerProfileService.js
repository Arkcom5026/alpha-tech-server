'use strict';

const repository = require('../shared/taxIssuerProfileRepository');

const normalizeBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'TAX_ISSUER_PROFILE_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  return branchId;
};

const getTaxIssuerProfile = async ({ branchId }) => ({
  profile: await repository.findByBranchId(normalizeBranchId(branchId)),
});

module.exports = Object.freeze({ getTaxIssuerProfile });
