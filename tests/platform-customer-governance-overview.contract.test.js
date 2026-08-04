const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/customer/routes/customerRoutes.js');
const repository = read('src/modules/customer/platform/overview/platformCustomerOverviewRepository.js');
const service = read('src/modules/customer/platform/overview/platformCustomerOverviewService.js');
const mission = read('docs/missions/platform-customer-governance-superadmin-workspace.md');

assert.match(routes, /router\.get\('\/platform\/overview'/);
assert.match(repository, /role:\s*'CUSTOMER'/);
assert.match(repository, /customerProfiles/);
assert.match(repository, /branch:\s*\{ select:/);
assert.match(service, /userContext\.role/);
assert.match(service, /SUPERADMIN/);
assert.match(service, /platformCustomerStatus:\s*'NOT_ESTABLISHED'/);
assert.match(service, /mode:\s*'READ_ONLY'/);
assert.doesNotMatch(repository, /sales|customerDeposits|outstandingDebt|creditBalance|repairJobs/);
assert.match(mission, /branchId = null.*not a platform customer/s);

console.log('platform-customer-governance-overview.contract: PASS');
