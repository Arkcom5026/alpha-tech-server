const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const routes = read('src/modules/repair/routes/repairRoutes.js');
const service = read('src/modules/repair/workflow/commands/transitionRepairWorkflowService.js');
const repository = read('src/modules/repair/workflow/commands/transitionRepairWorkflowRepository.js');
const controller = read('src/modules/repair/workflow/http/transitionRepairWorkflowController.js');

assert(
  routes.includes("'/jobs/:id/workflow/commands'"),
  'Command endpoint must remain mounted'
);
assert(
  service.includes("const { mapRepairJob } = require('../../mappers/repairMapper');"),
  'Workflow service must use the canonical Repair mapper'
);
assert(
  service.includes('repairJob: mapRepairJob(updated)'),
  'Command response must project a frontend-compatible RepairJob'
);
assert(
  repository.includes('customer: { include: { user: true } }'),
  'Workflow repository must load customer projection data'
);
assert(
  repository.includes('partsUsed: { include: { product: true } }'),
  'Workflow repository must load parts for the active job projection'
);
assert(
  repository.includes('warrantyClaims:'),
  'Workflow repository must load claims for the active job projection'
);
assert(
  controller.includes('availableActions: result.availableActions'),
  'Command response must expose server-owned available actions'
);
assert(
  controller.includes('repairJob: result.repairJob'),
  'Command response must expose the projected job'
);

console.log('Repair workflow command client cutover server contract: PASS');
