const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const authorization = read(
  'src/modules/repair/middlewares/repairAuthorization.js'
);
const repairActor = read('src/modules/repair/utils/repairActor.js');
const createRepairJobService = read('src/modules/repair/create/createRepairJobService.js');
const positionAuthority = read(
  'src/modules/employee/authorization/employeePositionAuthority.js'
);
const routes = read('src/modules/repair/routes/repairRoutes.js');

const requiredCapabilities = [
  'repair.read',
  'repair.intake',
  'repair.workflow',
  'repair.parts',
  'repair.estimate',
  'repair.claim',
  'repair.handover',
  'repair.customer-access',
  'repair.customer-override',
];

for (const capability of requiredCapabilities) {
  assert(
    authorization.includes(`'${capability}'`) || positionAuthority.includes(`'${capability}'`),
    `Missing Repair capability: ${capability}`
  );
}

assert(
  authorization.includes("require('../../employee/authorization/employeePositionAuthority')") &&
    authorization.includes('resolveActorCapabilities(actor)'),
  'Repair runtime must resolve authority through the centralized Position authority boundary'
);
assert(
  authorization.includes('capabilities: true') &&
    authorization.includes('positionCapabilities') &&
    authorization.includes('repairCapabilities: repairAuthority.capabilities'),
  'Employee context must refresh Position capabilities and publish filtered Repair capabilities'
);
assert(
  authorization.includes("positionAuthorityMode: repairAuthority.mode"),
  'Repair runtime must expose whether authority came from Position or compatibility fallback'
);
assert(
  repairActor.includes('repairCapabilities: normalizeCapabilities(user.repairCapabilities)') &&
    repairActor.includes('positionAuthorityMode: user.positionAuthorityMode || null'),
  'Repair actor projection must carry capability authority into application services'
);
assert(
  createRepairJobService.includes("const CUSTOMER_OVERRIDE_CAPABILITY = 'repair.customer-override'") &&
    createRepairJobService.includes('hasRepairCapability(actor, CUSTOMER_OVERRIDE_CAPABILITY)') &&
    !createRepairJobService.includes("actor.role === 'MANAGER'"),
  'Repair customer ownership override must be capability-owned rather than MANAGER-role-owned'
);
assert(
  authorization.includes('missingCapabilities'),
  'Capability denial must report missing capabilities'
);
assert(
  authorization.includes('TECHNICIAN: Object.freeze([') &&
    authorization.includes('REPAIR_CAPABILITY.WORKFLOW') &&
    authorization.includes('REPAIR_CAPABILITY.PARTS'),
  'Legacy technician compatibility matrix must remain available during migration'
);
assert(
  authorization.includes('CASHIER: Object.freeze([') &&
    authorization.includes('REPAIR_CAPABILITY.INTAKE') &&
    authorization.includes('REPAIR_CAPABILITY.ESTIMATE') &&
    authorization.includes('REPAIR_CAPABILITY.CLAIM'),
  'Legacy cashier compatibility matrix must remain available during migration'
);
assert(
  positionAuthority.includes("REPAIR_WORKFLOW: 'repair.workflow'") &&
    positionAuthority.includes("REPAIR_PARTS: 'repair.parts'") &&
    positionAuthority.includes("REPAIR_CUSTOMER_OVERRIDE: 'repair.customer-override'"),
  'Repair capabilities must be first-class Position capabilities'
);

assert(
  routes.includes('allowRepairCapabilities(REPAIR_CAPABILITY.WORKFLOW)'),
  'Workflow routes must require repair.workflow'
);
assert(
  routes.includes('allowRepairCapabilities(REPAIR_CAPABILITY.PARTS)'),
  'Parts route must require repair.parts'
);
assert(
  routes.includes('allowRepairCapabilities(REPAIR_CAPABILITY.HANDOVER)'),
  'Handover finalization must require repair.handover'
);
assert(
  routes.includes('allowRepairCapabilities(REPAIR_CAPABILITY.CUSTOMER_ACCESS)'),
  'Tracking access routes must require repair.customer-access'
);
assert(
  !routes.includes('READ_AND_INTAKE_ROLES') &&
    !routes.includes('OPERATION_ROLES') &&
    !routes.includes('allowRepairRoles('),
  'Repair routes must not use coarse role groups after capability cutover'
);

const publicTrackingIndex = routes.indexOf("router.get('/public/tracking/:token'");
const verificationIndex = routes.indexOf('router.use(verifyToken)');
assert(
  publicTrackingIndex >= 0 && publicTrackingIndex < verificationIndex,
  'Customer-safe public endpoints must remain outside staff authorization'
);

console.log('Repair capability authorization integration contract: PASS');
