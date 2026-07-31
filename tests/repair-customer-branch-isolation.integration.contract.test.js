const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read('src/modules/repair/policies/repairCustomerBranchAccessPolicy.js');
const searchRepository = read('src/modules/repair/query/intake-search/intakeSearchRepository.js');
const createRepository = read('src/modules/repair/create/createRepairJobRepository.js');
const createService = read('src/modules/repair/create/createRepairJobService.js');
const externalRepository = read('src/modules/repair/external-intake/externalDeviceIntakeRepository.js');
const externalService = read('src/modules/repair/external-intake/createExternalDeviceIntakeService.js');
const warrantyRepository = read('src/modules/repair/query/customer-warranty-assets/customerWarrantyAssetsRepository.js');
const warrantyService = read('src/modules/repair/query/customer-warranty-assets/customerWarrantyAssetsService.js');

for (const evidence of [
  "{ sale: { some: { branchId } } }",
  "{ repairJobs: { some: { branchId } } }",
  "{ deviceIntakes: { some: { branchId } } }",
  "{ ownedDevices: { some: { branchId, status: { not: 'RETIRED' } } } }",
]) {
  assert(policy.includes(evidence), `Missing branch evidence: ${evidence}`);
}

for (const source of [searchRepository, createRepository, externalRepository, warrantyRepository]) {
  assert(source.includes('repairCustomerBranchAccessPolicy'), 'Repository must use the central branch access policy');
}

assert(searchRepository.includes('buildCustomerBranchEvidence(normalizedBranchId)'), 'Search must scope customers by branch evidence');
assert(createRepository.includes('findCustomer(branchId, customerId)'), 'Create repository must require branchId');
assert(createService.includes('repo.findCustomer(actor.branchId, payload.customerId)'), 'Create service must pass actor branch');
assert(externalRepository.includes('findCustomer(branchId, customerId)'), 'External intake repository must require branchId');
assert(externalService.includes('repo.findCustomer(actor.branchId, payload.customerId)'), 'External intake service must pass actor branch');
assert(warrantyRepository.includes('findCustomer(branchId, customerId)'), 'Warranty repository must require branchId');
assert(warrantyService.includes('this.repository.findCustomer(actor.branchId, customerId)'), 'Warranty service must pass actor branch');

for (const source of [createRepository, externalRepository, warrantyRepository]) {
  assert(source.includes('customerProfile.findFirst'), 'Scoped lookup must use findFirst');
  assert(!source.includes('customerProfile.findUnique'), 'Global CustomerProfile findUnique must not remain');
}

console.log('Repair customer branch isolation integration contract: PASS');
