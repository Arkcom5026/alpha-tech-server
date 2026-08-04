const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const route = read('src/modules/customer/routes/customerRoutes.js');
const controllerPath = path.join(root, 'src/modules/customer/query/self/customerSelfController.js');
const controller = fs.readFileSync(controllerPath, 'utf8');
const service = read('src/modules/customer/query/self/customerSelfService.js');
const repository = read('src/modules/customer/query/self/customerSelfRepository.js');
const legacyControllerPath = path.join(
  root,
  'src/modules/customer/controllers/customerQueryController.js'
);

assert.match(route, /require\('\.\.\/query\/self\/customerSelfController'\)/);
assert.match(route, /router\.get\('\/me', customerSelfController\.getCustomerSelf\)/);
assert.doesNotMatch(route, /getCustomerByUserId/);

assert.doesNotThrow(
  () => require(controllerPath),
  'customer self-query dependency graph must resolve at startup'
);

assert.doesNotMatch(controller, /lib\/prisma|prisma\./);
assert.doesNotMatch(service, /lib\/prisma|prisma\./);
assert.match(controller, /customerProfileId:\s*req\.user\?\.customerProfileId/);
assert.match(service, /ACTIVE_CUSTOMER_PROFILE_REQUIRED/);
assert.match(service, /findActiveCustomerProfile/);
assert.match(repository, /prisma\.customerProfile\.findFirst/);
assert.match(repository, /id:\s*profileId/);
assert.match(repository, /userId:\s*platformUserId/);
assert.doesNotMatch(repository, /findUnique\([\s\S]*where:\s*\{\s*userId\s*\}/);
assert.match(service, /role !== 'CUSTOMER'/);
assert.match(service, /Forbidden/);
assert.match(service, /ไม่พบข้อมูลลูกค้า/);
assert.match(controller, /เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า/);
assert.match(service, /companyName:/);
assert.match(service, /taxId:/);
assert.doesNotMatch(service, /creditLimit:/);
assert.doesNotMatch(service, /creditBalance:/);
assert.doesNotMatch(service, /type:/);
assert.strictEqual(
  fs.existsSync(legacyControllerPath),
  false,
  'legacy customer query controller must be retired after self-query cutover'
);

console.log('customer-self-query-slice.contract: PASS');
