const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'src/modules/customer/routes/customerRoutes.js');
const controllerPath = path.join(root, 'src/modules/customer/query/search/customerSearchController.js');
const servicePath = path.join(root, 'src/modules/customer/query/search/customerSearchService.js');
const repositoryPath = path.join(root, 'src/modules/customer/query/search/customerSearchRepository.js');
const policyPath = path.join(root, 'src/modules/customer/policies/customerBranchAccessPolicy.js');
const repairPolicyPath = path.join(
  root,
  'src/modules/repair/policies/repairCustomerBranchAccessPolicy.js'
);

for (const file of [routePath, controllerPath, servicePath, repositoryPath, policyPath, repairPolicyPath]) {
  assert.ok(fs.existsSync(file), `${path.relative(root, file)} must exist`);
}

const routeSource = fs.readFileSync(routePath, 'utf8');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const repositorySource = fs.readFileSync(repositoryPath, 'utf8');
const policySource = fs.readFileSync(policyPath, 'utf8');
const repairPolicySource = fs.readFileSync(repairPolicyPath, 'utf8');
const { isPhoneLikeQuery } = require(servicePath);

assert.match(routeSource, /router\.get\('\/search',\s*customerSearchController\.searchCustomers\)/);
assert.match(controllerSource, /req\.user\?\.branchId/);
assert.match(controllerSource, /req\.query\?\.q/);
assert.doesNotMatch(controllerSource, /prisma\./);
assert.match(serviceSource, /CUSTOMER_SEARCH_QUERY_TOO_SHORT/);
assert.match(serviceSource, /results:\s*customers\.map/);
assert.match(serviceSource, /departmentName:\s*customer\.departmentName/);
assert.doesNotMatch(serviceSource, /stockItem|serialNumber|imei|serviceTag/i);
assert.equal(isPhoneLikeQuery('081-234-5678'), true);
assert.equal(isPhoneLikeQuery('+66 81 234 5678'), true);
assert.equal(isPhoneLikeQuery('user123@example.com'), false);
assert.equal(isPhoneLikeQuery('Company 123'), false);
assert.match(repositorySource, /buildCustomerBranchEvidence\(branchId\)/);
assert.match(repositorySource, /customerProfile\.findMany/);
assert.match(repositorySource, /companyName/);
assert.match(repositorySource, /departmentName/);
assert.match(repositorySource, /taxId/);
assert.match(repositorySource, /loginId/);
assert.match(repositorySource, /email/);
assert.doesNotMatch(repositorySource, /stockItem|serialNumber|imei|serviceTag/i);
assert.match(policySource, /return \{ branchId \}/);
assert.match(policySource, /return \{ id: \{ equals: -1 \} \}/);
assert.doesNotMatch(policySource, /sales:\s*\{\s*some/);
assert.doesNotMatch(policySource, /repairJobs:\s*\{\s*some/);
assert.doesNotMatch(policySource, /deviceIntakes:\s*\{\s*some/);
assert.doesNotMatch(policySource, /ownedDevices:\s*\{\s*some/);
assert.match(repairPolicySource, /customer\/policies\/customerBranchAccessPolicy/);

require(controllerPath);

console.log('customer-unified-search-slice.contract: PASS');
