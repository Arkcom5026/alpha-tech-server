const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...segments) => fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

const communicationRoutes = read('src', 'modules', 'communication', 'communicationRoutes.js');
const handoverService = read('src', 'modules', 'repair', 'handover', 'repairHandoverService.js');
const handoverRepository = read('src', 'modules', 'repair', 'handover', 'repairHandoverRepository.js');
const estimateService = read('src', 'modules', 'repair', 'estimate-approval', 'repairEstimateApprovalService.js');
const evidenceRepository = read('src', 'modules', 'repair', 'intake-evidence', 'intakeEvidenceRepository.js');

test('communication routes reuse the database-verified auth employee context', () => {
  assert.match(communicationRoutes, /req\.user\?\.employeeActive === true/);
  assert.match(communicationRoutes, /req\.user\?\.employeeApproved === true/);
  assert.match(communicationRoutes, /req\.communicationBranchId = branchId/);
  assert.doesNotMatch(communicationRoutes, /employeeProfile\.findUnique/);
  assert.doesNotMatch(communicationRoutes, /database\/prisma\/client/);
});

test('handover staff read starts independent authority reads together', () => {
  assert.match(handoverService, /const jobPromise = repository\.findJob/);
  assert.match(handoverService, /const deliveryPromise = repository\.findDelivery/);
  assert.match(handoverService, /const activeSubcontractPromise =/);
  assert.match(handoverService, /const repairOwnedEventPromise =/);
  assert.match(handoverService, /await Promise\.all\(\[/);
  assert.match(handoverService, /findLatestPassportWorkflowEvent/);
});

test('handover workflow read prefers RepairWorkflowEvent before passport compatibility', () => {
  assert.match(handoverRepository, /FROM "RepairWorkflowEvent"/);
  assert.match(handoverRepository, /findLatestRepairOwnedWorkflowEvent/);
  assert.match(handoverRepository, /if \(repairOwned\) return repairOwned/);
  assert.match(handoverRepository, /findLatestPassportWorkflowEvent/);
});

test('estimate approval staff read runs authorization and latest snapshot in parallel', () => {
  assert.match(estimateService, /const \[job, latest\] = await Promise\.all\(\[/);
  assert.match(estimateService, /findRepairJobForStaff\(repairJobId, actor\.branchId\)/);
  assert.match(estimateService, /findLatest\(repairJobId\)/);
});

test('intake evidence read selects only the response projection', () => {
  assert.match(evidenceRepository, /select: \{/);
  assert.match(evidenceRepository, /referenceNo: true/);
  assert.match(evidenceRepository, /receivedAt: true/);
  assert.match(evidenceRepository, /photos: \{/);
  assert.doesNotMatch(evidenceRepository, /include: \{/);
});
