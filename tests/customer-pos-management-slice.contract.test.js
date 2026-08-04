const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/customer/routes/customerRoutes.js');
const repository = read('src/modules/customer/management/customerManagementRepository.js');
const service = read('src/modules/customer/management/customerManagementService.js');
const controllerPath = path.join(
  root,
  'src/modules/customer/management/customerManagementController.js'
);

assert.match(routes, /router\.get\('\/management'/);
assert.match(routes, /router\.post\('\/management\/unassigned\/:id\/claim'/);
assert.match(repository, /branchId:\s*scope === 'UNASSIGNED' \? null : branchId/);
assert.match(repository, /where:\s*\{ id: customerProfileId, branchId: null \}/);
assert.match(repository, /customerProfile\.updateMany/);
assert.match(repository, /where:\s*\{ branchId, userId: existing\.userId \}/);
assert.match(service, /STORE_CUSTOMER_ALREADY_EXISTS/);
assert.match(service, /CUSTOMER_ALREADY_ASSIGNED/);
assert.match(service, /allowedRoles/);
assert.doesNotThrow(() => require(controllerPath));

console.log('customer-pos-management-slice.contract: PASS');
