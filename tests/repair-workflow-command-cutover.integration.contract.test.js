const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const repository = read(
  'src/modules/repair/workflow/commands/transitionRepairWorkflowRepository.js'
);
const service = read(
  'src/modules/repair/workflow/commands/transitionRepairWorkflowService.js'
);
const controller = read(
  'src/modules/repair/workflow/http/transitionRepairWorkflowController.js'
);
const routes = read('src/modules/repair/routes/repairRoutes.js');

for (const requiredInclude of [
  'customer: { include: { user: true } }',
  'stockItem:',
  'technician: true',
  'partsUsed:',
  'warrantyClaims:',
]) {
  assert(
    repository.includes(requiredInclude),
    `Workflow repository is missing canonical detail include: ${requiredInclude}`
  );
}

assert(
  service.includes("const { mapRepairJob } = require('../../mappers/repairMapper')"),
  'Workflow command service must import the canonical Repair mapper'
);
assert(
  service.includes('repairJob: mapRepairJob(updated)'),
  'Workflow command response must publish the canonical RepairJob projection'
);
assert(
  service.includes('expectedWorkflowStatus'),
  'Workflow command must preserve optimistic concurrency authority'
);
assert(
  service.includes('commandKey'),
  'Workflow command must preserve idempotency identity'
);
assert(
  controller.includes('availableActions: result.availableActions'),
  'HTTP response must expose server-owned available workflow actions'
);
assert(
  routes.includes("'/jobs/:id/workflow/commands'"),
  'Repair workflow command endpoint must remain mounted'
);

console.log('Repair workflow command cutover integration contract: PASS');
