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
];

for (const capability of requiredCapabilities) {
  assert(
    authorization.includes(`'${capability}'`),
    `Missing Repair capability: ${capability}`
  );
}

assert(
  authorization.includes('repairCapabilities: resolveRepairCapabilities(v2Role)'),
  'Employee context must publish resolved Repair capabilities'
);
assert(
  authorization.includes('missingCapabilities'),
  'Capability denial must report missing capabilities'
);
assert(
  authorization.includes('TECHNICIAN: Object.freeze([') &&
    authorization.includes('REPAIR_CAPABILITY.WORKFLOW') &&
    authorization.includes('REPAIR_CAPABILITY.PARTS'),
  'Technician profile must receive workflow and parts capabilities'
);
assert(
  authorization.includes('CASHIER: Object.freeze([') &&
    authorization.includes('REPAIR_CAPABILITY.INTAKE') &&
    authorization.includes('REPAIR_CAPABILITY.ESTIMATE') &&
    authorization.includes('REPAIR_CAPABILITY.CLAIM'),
  'Cashier profile must receive intake, estimate, and claim capabilities'
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
