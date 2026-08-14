const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('repair detail starts branch-scoped critical reads in one wave', () => {
  const source = read('src/modules/repair/query/job-detail/repairJobDetailRepository.js');

  assert.match(source, /const jobPromise = prisma\.repairJob\.findFirst/);
  assert.match(source, /const serializedPartMovementsPromise = prisma\.stockMovement\.findMany/);
  assert.match(source, /const repairOwnedLatestPromise = findLatestRepairWorkflowEvent/);
  assert.match(source, /const repairOwnedHistoryPromise = findRepairWorkflowHistory/);
  assert.match(source, /await Promise\.all\(\[/);
  assert.match(source, /branchId: branch/);
  assert.match(source, /"branchId" = \$2/);
});

test('passport reads remain optional after repair-owned detail authority resolves', () => {
  const source = read('src/modules/repair/query/job-detail/repairJobDetailRepository.js');

  assert.match(source, /if \(job\.deviceId\)/);
  assert.match(source, /passportLatest, passportDiagnosis, passportHistory/);
  assert.match(source, /repairOwnedLatest \|\| passportLatest/);
  assert.match(source, /repairOwnedHistory\.length > 0 \? repairOwnedHistory : passportHistory/);
});

test('handover staff read parallelizes independent state after branch ownership check', () => {
  const source = read('src/modules/repair/handover/repairHandoverService.js');

  assert.match(source, /const job = await repository\.findJob\(repairJobId, actor\.branchId\)/);
  assert.match(source, /const \[delivery, activeSubcontract, workflowStatus\] = await Promise\.all/);
  assert.match(source, /repository\.findDelivery\(job\.id\)/);
  assert.match(source, /repository\.findActiveSubcontract\(job\.id\)/);
  assert.match(source, /workflowStatusFor\(job\)/);
});

test('handover workflow reads Repair-owned authority before optional passport projection', () => {
  const source = read('src/modules/repair/handover/repairHandoverRepository.js');

  assert.match(source, /findLatestRepairWorkflowEvent/);
  assert.match(source, /repairOwnedPromise/);
  assert.match(source, /passportPromise = deviceId/);
  assert.match(source, /return repairOwned \|\| passport \|\| null/);
});
