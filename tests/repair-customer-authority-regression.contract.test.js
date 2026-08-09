const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const files = {
  sharedPolicy: 'src/modules/customer/policies/customerBranchAccessPolicy.js',
  repairPolicy: 'src/modules/repair/policies/repairCustomerBranchAccessPolicy.js',
  intakeSearch: 'src/modules/repair/query/intake-search/intakeSearchRepository.js',
  createRepairJob: 'src/modules/repair/create/createRepairJobRepository.js',
  externalIntake: 'src/modules/repair/external-intake/externalDeviceIntakeRepository.js',
  warrantyAssets: 'src/modules/repair/query/customer-warranty-assets/customerWarrantyAssetsRepository.js',
};

const branchEvidenceCall = /buildCustomerBranchEvidence\((?:normalizedBranchId|branchId)\)/;

test('Repair customer consumers preserve the shared branch authority boundary', () => {
  Object.values(files).forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} must exist`);
  });

  const sharedPolicy = read(files.sharedPolicy);
  const repairPolicy = read(files.repairPolicy);

  assert.match(repairPolicy, /customer\/policies\/customerBranchAccessPolicy/);
  assert.match(repairPolicy, /buildCustomerBranchEvidence/);
  assert.doesNotMatch(repairPolicy, /sales:\s*\{|repairJobs:\s*\{|deviceIntakes:\s*\{|ownedDevices:\s*\{/);

  assert.match(sharedPolicy, /return \{ branchId \}/);
  assert.match(sharedPolicy, /return \{ id: \{ equals: -1 \} \}/);
  assert.doesNotMatch(sharedPolicy, /sales:\s*\{|repairJobs:\s*\{|deviceIntakes:\s*\{|ownedDevices:\s*\{/);

  [files.intakeSearch, files.createRepairJob, files.externalIntake, files.warrantyAssets]
    .map(read)
    .forEach((source) => {
      assert.match(source, /repairCustomerBranchAccessPolicy/);
      assert.match(source, branchEvidenceCall);
      assert.doesNotMatch(source, /customerProfile\.findUnique/);
    });
});

test('Repair persistence and warranty queries remain explicitly branch scoped', () => {
  const createRepairJob = read(files.createRepairJob);
  const externalIntake = read(files.externalIntake);
  const warrantyAssets = read(files.warrantyAssets);
  const intakeSearch = read(files.intakeSearch);

  assert.match(intakeSearch, /const normalizedBranchId = Number\(branchId\)/);
  assert.match(intakeSearch, /buildCustomerBranchEvidence\(normalizedBranchId\)/);
  assert.match(createRepairJob, /findCustomer\(branchId, customerId\)/);
  assert.match(externalIntake, /findCustomer\(branchId, customerId\)/);
  assert.match(warrantyAssets, /findCustomer\(branchId, customerId\)/);

  assert.match(externalIntake, /branchId:\s*Number\(branchId\)/);
  assert.match(warrantyAssets, /branchId:\s*Number\(branchId\)/);
  assert.match(warrantyAssets, /customerId:\s*Number\(customerId\)/);
});
