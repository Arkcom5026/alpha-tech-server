const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function requireTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    assert.ok(content.includes(token), `${relativePath} missing workflow token: ${token}`);
  }
  return content;
}

function run() {
  const transitionPolicy = requireTokens(
    'src/modules/repair/policies/repairTransitionPolicy.js',
    [
      "RECEIVED: ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED']",
      "IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED']",
      "WAITING_PARTS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED']",
      'COMPLETED: []',
      'CANCELLED: []',
      "DRAFT: ['SUBMITTED', 'CANCELLED']",
      "RESOLVED: []",
      'assertRepairTransition',
      'assertClaimTransition',
      'RepairFailureCode.INVALID_REPAIR_TRANSITION',
      'RepairFailureCode.INVALID_CLAIM_TRANSITION',
    ]
  );

  assert.ok(
    !transitionPolicy.includes("COMPLETED: ['"),
    'COMPLETED repair status must remain terminal'
  );
  assert.ok(
    !transitionPolicy.includes("CANCELLED: ['"),
    'CANCELLED repair status must remain terminal'
  );

  requireTokens('src/modules/repair/services/repairService.js', [
    'assertRepairTransition(job.status, payload.status)',
    "if (payload.status === 'IN_PROGRESS')",
    'assertRepairExecutionAuthorized({',
    "if (['COMPLETED', 'CANCELLED'].includes(job.status))",
    'RepairFailureCode.REPAIR_JOB_TERMINAL',
  ]);

  requireTokens('src/modules/repair/services/repairCompletionService.js', [
    "if (payload.status !== 'COMPLETED')",
    'assertRepairTransition(job.status, payload.status)',
    'assertRepairCanComplete(job)',
    'buildCompletionReadiness',
    'if (!readiness.readyForCompletion)',
    'RepairFailureCode.REPAIR_COMPLETION_READINESS_REQUIRED',
    "status: 'COMPLETED'",
  ]);

  requireTokens('src/modules/repair/policies/repairCompletionPolicy.js', [
    "const TERMINAL_CLAIM_STATUSES = new Set(['RESOLVED', 'CANCELLED'])",
    'activeWarrantyClaims(job)',
    'RepairFailureCode.ACTIVE_CLAIM_BLOCKS_COMPLETION',
  ]);

  requireTokens('src/modules/repair/services/repairHandoverService.js', [
    "if (job.status !== 'COMPLETED')",
    'RepairFailureCode.REPAIR_JOB_NOT_READY_FOR_HANDOVER',
    'activeWarrantyClaims(job)',
    'RepairFailureCode.ACTIVE_CLAIM_BLOCKS_HANDOVER',
    'assertFinanciallyReadyForHandover(job, existingMetadata)',
    'RepairFailureCode.REPAIR_SETTLEMENT_REQUIRED',
    "status: 'RETURNED_TO_CUSTOMER'",
    'idempotent: true',
    'idempotent: false',
  ]);

  requireTokens('src/modules/repair/services/warrantyClaimService.js', [
    'assertRepairCanOpenClaim(job)',
    'assertNoActiveClaimForJob(job)',
    "status: 'DRAFT'",
    "status: 'IN_CLAIM'",
    'assertResolutionRequirements(payload)',
    'assertClaimTransition(claim.status, payload.status)',
    'claimTimestampData(payload.status, now)',
    'assetStatusForClaim(payload.status)',
  ]);

  requireTokens('src/modules/repair/policies/warrantyClaimPolicy.js', [
    'assertRepairCanOpenClaim',
    'assertNoActiveClaimForJob',
    'assertResolutionRequirements',
  ]);

  requireTokens('src/modules/repair/services/repairEstimateService.js', [
    'REPAIR_ESTIMATE_ALREADY_DECIDED',
    'ACTIVE_REPAIR_ESTIMATE_EXISTS',
  ]);

  requireTokens('src/modules/repair/services/repairPartReversalService.js', [
    'REPAIR_PART_REVERSAL_REASON_REQUIRED',
  ]);

  console.log('Repair workflow integrity audit: PASS');
}

run();
