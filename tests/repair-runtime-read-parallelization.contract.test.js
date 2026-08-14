const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('handover staff read parallelizes independent delivery, subcontract, and workflow lookups', () => {
  const source = read('src/modules/repair/handover/repairHandoverService.js');

  assert.match(source, /const \[delivery, activeSubcontract, workflowEvent\] = await Promise\.all\(/);
  assert.match(source, /repository\.findDelivery\(job\.id\)/);
  assert.match(source, /repository\.findActiveSubcontract\(job\.id\)/);
  assert.match(source, /repository\.findLatestWorkflowEvent\(job\.id, job\.deviceId, job\.branchId\)/);
  assert.match(source, /workflowStatus: workflowEvent\?\.metadata\?\.workflowTargetStatus \|\| 'RECEIVED'/);
});

test('estimate staff read overlaps branch guard lookup with latest approval lookup', () => {
  const source = read('src/modules/repair/estimate-approval/repairEstimateApprovalService.js');

  assert.match(source, /const \[job, latest\] = await Promise\.all\(/);
  assert.match(source, /this\.repository\.findRepairJobForStaff\(repairJobId, actor\.branchId\)/);
  assert.match(source, /this\.repository\.findLatest\(repairJobId\)/);
  assert.match(source, /if \(!job\)/);
  assert.match(source, /approval: mapApproval\(latest\)/);
});

test('parallel read hardening does not remove branch ownership guards', () => {
  const handover = read('src/modules/repair/handover/repairHandoverService.js');
  const estimate = read('src/modules/repair/estimate-approval/repairEstimateApprovalService.js');

  assert.match(handover, /repository\.findJob\(repairJobId, actor\.branchId\)/);
  assert.match(estimate, /findRepairJobForStaff\(repairJobId, actor\.branchId\)/);
});
