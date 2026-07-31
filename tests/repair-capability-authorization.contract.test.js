const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const authorization = fs.readFileSync(
  path.join(root, 'src/modules/repair/middlewares/repairAuthorization.js'),
  'utf8'
);
const routes = fs.readFileSync(
  path.join(root, 'src/modules/repair/routes/repairRoutes.js'),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

[
  'repair.read',
  'repair.intake',
  'repair.workflow',
  'repair.parts',
  'repair.estimate',
  'repair.claim',
  'repair.handover',
  'repair.customer-access',
].forEach((capability) => {
  assert(authorization.includes(`'${capability}'`), `Missing capability ${capability}`);
});

assert(
  authorization.includes('repairCapabilities: [...resolveRepairCapabilities(v2Role)]'),
  'Employee context must publish resolved repair capabilities'
);
assert(
  authorization.includes('const allowRepairCapabilities = (...capabilities)'),
  'Capability middleware must exist'
);
assert(
  authorization.includes('missingCapabilities'),
  'Forbidden errors must expose missing capabilities'
);
assert(
  authorization.includes('TECHNICIAN: Object.freeze(['),
  'Technician capability profile must exist'
);
assert(
  authorization.includes('REPAIR_CAPABILITY.WORKFLOW') &&
    authorization.includes('REPAIR_CAPABILITY.PARTS'),
  'Technicians must receive workflow and parts capabilities'
);

assert(!routes.includes('READ_AND_INTAKE_ROLES'), 'Legacy route role group must be retired');
assert(!routes.includes('OPERATION_ROLES'), 'Legacy operation role group must be retired');
assert(!routes.includes('allowRepairRoles('), 'Repair routes must not authorize by role directly');
assert(
  routes.includes("router.get('/jobs', can(REPAIR_CAPABILITY.READ), listRepairJobs);"),
  'Job list must require read capability'
);
assert(
  routes.includes("router.post('/jobs', can(REPAIR_CAPABILITY.INTAKE), createRepairJob);"),
  'Job creation must require intake capability'
);
assert(
  routes.includes("can(REPAIR_CAPABILITY.WORKFLOW),\n  transitionRepairWorkflow"),
  'Workflow commands must require workflow capability'
);
assert(
  routes.includes("router.post('/jobs/:id/parts', can(REPAIR_CAPABILITY.PARTS), addRepairPart);"),
  'Parts usage must require parts capability'
);
assert(
  routes.includes('can(REPAIR_CAPABILITY.ESTIMATE)'),
  'Estimate publication must require estimate capability'
);
assert(
  routes.includes('can(REPAIR_CAPABILITY.CLAIM)'),
  'Claim mutation must require claim capability'
);
assert(
  routes.includes('can(REPAIR_CAPABILITY.HANDOVER)'),
  'Handover finalization must require handover capability'
);
assert(
  routes.includes('can(REPAIR_CAPABILITY.CUSTOMER_ACCESS)'),
  'Tracking access mutation must require customer-access capability'
);

console.log('Repair capability authorization contract: PASS');
