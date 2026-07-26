const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertContains(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

const policy = read(
  'src/modules/repair/policies/repairExecutionAuthorizationPolicy.js'
);
const service = read('src/modules/repair/services/repairService.js');
const errors = read('src/modules/repair/contracts/repairError.js');

assertContains(policy, "'CUSTOMER_APPROVED'", 'customer approval authority');
assertContains(policy, "'WARRANTY_CLAIM'", 'warranty claim authority');
assertContains(policy, "'NO_CHARGE'", 'no-charge authority');
assertContains(
  policy,
  "item.status === 'APPROVED'",
  'approved estimate requirement'
);
assertContains(
  policy,
  'ACTIVE_CLAIM_STATUSES.has(claim.status)',
  'active warranty claim requirement'
);
assertContains(
  policy,
  'REPAIR_EXECUTION_REASON_REQUIRED',
  'no-charge reason requirement'
);
assertContains(
  service,
  "payload.status === 'IN_PROGRESS'",
  'in-progress transition guard'
);
assertContains(
  service,
  'assertRepairExecutionAuthorized({',
  'execution authorization enforcement'
);
assertContains(
  service,
  'const asset = await loadExecutionAsset(repo, actor, job);',
  'service asset metadata lookup'
);
assertContains(
  errors,
  'APPROVED_REPAIR_ESTIMATE_REQUIRED',
  'approved estimate failure code'
);
assertContains(
  errors,
  'ACTIVE_WARRANTY_CLAIM_REQUIRED',
  'warranty claim failure code'
);

console.log('Repair Execution Authorization Guard: PASS');
