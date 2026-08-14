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
  assert.match(source, /const repairOwnedHistoryPromise = findRepairWorkflowHistory/);
  assert.match(source, /await Promise\.all\(\[/);
  assert.match(source, /branchId: branch/);
  assert.match(source, /"branchId" = \$2/);
});

test('passport reads remain optional after repair-owned detail authority resolves', () => {
  const source = read('src/modules/repair/query/job-detail/repairJobDetailRepository.js');

  assert.match(source, /if \(!repairOwnedHistory\.length && job\.deviceId\)/);
  assert.match(source, /passportHistory = history/);
  assert.match(source, /repairOwnedLatest \|\| passportLatest/);
  assert.match(source, /repairOwnedHistory\.length > 0 \? repairOwnedHistory : passportHistory/);
});

test('handover staff read parallelizes branch-scoped state before optional Passport compatibility', () => {
  const source = read('src/modules/repair/handover/repairHandoverService.js');

  assert.match(source, /const jobPromise = repository\.findJob\(repairJobId, actor\.branchId\)/);
  assert.match(source, /const deliveryPromise = repository\.findDelivery\(repairJobId\)/);
  assert.match(source, /const activeSubcontractPromise/);
  assert.match(source, /const repairOwnedEventPromise/);
  assert.match(source, /const \[job, delivery, activeSubcontract, repairOwnedEvent\] = await Promise\.all/);
  assert.match(source, /if \(job\.deviceId && typeof repository\.findLatestPassportWorkflowEvent/);
});

test('handover workflow keeps newest Repair-owned authority with Passport compatibility fallback', () => {
  const source = read('src/modules/repair/handover/repairHandoverRepository.js');

  assert.match(source, /findLatestRepairOwnedWorkflowEvent/);
  assert.match(source, /findLatestPassportWorkflowEvent/);
  assert.match(source, /newestWorkflowEvent\(repairOwned, passport\)/);
});
