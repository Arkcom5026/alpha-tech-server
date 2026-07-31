const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const intakeSearchRepository = read(
  'src/modules/repair/query/intake-search/intakeSearchRepository.js'
);
const createRepository = read(
  'src/modules/repair/create/createRepairJobRepository.js'
);
const createService = read(
  'src/modules/repair/create/createRepairJobService.js'
);
const externalRepository = read(
  'src/modules/repair/external-intake/externalDeviceIntakeRepository.js'
);
const externalService = read(
  'src/modules/repair/external-intake/createExternalDeviceIntakeService.js'
);
const warrantyRepository = read(
  'src/modules/repair/query/customer-warranty-assets/customerWarrantyAssetsRepository.js'
);
const warrantyService = read(
  'src/modules/repair/query/customer-warranty-assets/customerWarrantyAssetsService.js'
);

const requiredEvidence = [
  "{ sale: { some: { branchId } } }",
  "{ repairJobs: { some: { branchId } } }",
  "{ deviceIntakes: { some: { branchId } } }",
  "{ ownedDevices: { some: { branchId, status: { not: 'RETIRED' } } } }",
];

for (const source of [intakeSearchRepository, createRepository, externalRepository, warrantyRepository]) {
  assert(
    source.includes('buildCustomerBranchEvidence'),
    'Every Repair customer repository boundary must expose branch evidence'
  );
  for (const evidence of requiredEvidence) {
    assert(source.includes(evidence), `Missing customer branch evidence: ${evidence}`);
  }
}

assert(
  intakeSearchRepository.includes('buildCustomerBranchEvidence(normalizedBranchId)'),
  'Intake search must scope CustomerProfile results by authenticated branch evidence'
);
assert(
  !intakeSearchRepository.includes("this.prisma.customerProfile.findMany({\n        where: {\n          OR:"),
  'Intake customer search must not perform an unscoped global lookup'
);

assert(
  createRepository.includes('findCustomer(branchId, customerId)'),
  'Repair creation repository must require branchId for customer lookup'
);
assert(
  createService.includes('repo.findCustomer(actor.branchId, payload.customerId)'),
  'Repair creation service must pass authenticated actor.branchId'
);

assert(
  externalRepository.includes('findCustomer(branchId, customerId)'),
  'External intake repository must require branchId for customer lookup'
);
assert(
  externalService.includes('repo.findCustomer(actor.branchId, payload.customerId)'),
  'External intake service must pass authenticated actor.branchId'
);

assert(
  warrantyRepository.includes('findCustomer(branchId, customerId)'),
  'Warranty asset repository must require branchId for customer lookup'
);
assert(
  warrantyService.includes('this.repository.findCustomer(actor.branchId, customerId)'),
  'Warranty asset service must pass authenticated actor.branchId'
);

for (const source of [createRepository, externalRepository, warrantyRepository]) {
  assert(
    source.includes('customerProfile.findFirst'),
    'Scoped customer lookup must use findFirst with branch evidence'
  );
  assert(
    !source.includes('customerProfile.findUnique'),
    'Repair write/read boundaries must not use global CustomerProfile findUnique'
  );
}

console.log('Repair customer branch isolation contract: PASS');
