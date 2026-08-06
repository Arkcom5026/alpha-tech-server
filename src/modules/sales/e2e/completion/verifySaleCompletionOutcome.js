'use strict';

const {
  resolveSaleCompletionE2ERuntimeAuthority,
} = require('./saleCompletionE2ERuntimeAuthority');
const {
  verifySaleCompletionOutcome,
} = require('./verify/verifySaleCompletionOutcome');

const saleId = Number(process.argv[2] || process.env.POS_SALE_E2E_SALE_ID);
const branchId = Number(process.argv[3] || process.env.POS_SALE_E2E_BRANCH_ID);

if (!Number.isInteger(saleId) || saleId <= 0 || !Number.isInteger(branchId) || branchId <= 0) {
  throw new Error(
    'Usage: node verifySaleCompletionOutcome.js <sale-id> <branch-id> '
      + 'or set POS_SALE_E2E_SALE_ID and POS_SALE_E2E_BRANCH_ID.'
  );
}

const authority = resolveSaleCompletionE2ERuntimeAuthority({ requiresWrite: false });
process.env.DATABASE_URL = authority.targetUrl;
process.env.DIRECT_URL = authority.targetUrl;
const { prisma } = require('../../../../../lib/prisma');

const fail = (message, details = {}) => {
  console.log(JSON.stringify({
    result: 'FAIL',
    databaseModified: false,
    saleId,
    branchId,
    environment: authority.environment,
    authority: authority.target,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

async function main() {
  if (
    authority.expectedBranch
    && branchId !== authority.expectedBranch.branchId
  ) {
    return fail('Requested branch is outside the fixed Main-DB test tenant.', {
      expectedBranchId: authority.expectedBranch.branchId,
      actualBranchId: branchId,
    });
  }

  const evidence = await verifySaleCompletionOutcome({ prisma, saleId, branchId });

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: false,
    environment: authority.environment,
    authority: authority.target,
    evidence,
  }, null, 2));
}

main()
  .catch((error) => {
    fail(error.message || String(error), {
      name: error.name,
      stack: process.env.E2E_DEBUG === '1' ? error.stack : undefined,
    });
  })
  .finally(() => prisma.$disconnect());
