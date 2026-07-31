const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const route = read('src/modules/customer/routes/customerRoutes.js');
const legacyController = read('src/modules/customer/controllers/customerQueryController.js');
const controllerPath = path.join(
  root,
  'src/modules/customer/query/by-name/customerByNameController.js'
);
const controller = fs.readFileSync(controllerPath, 'utf8');
const service = read('src/modules/customer/query/by-name/customerByNameService.js');
const repository = read('src/modules/customer/query/by-name/customerByNameRepository.js');

assert.match(route, /require\('\.\.\/query\/by-name\/customerByNameController'\)/);
assert.match(
  route,
  /router\.get\('\/by-name', customerByNameController\.getCustomerByName\)/
);
assert.doesNotMatch(route, /router\.get\('\/by-name', getCustomerByName\)/);

assert.doesNotThrow(
  () => require(controllerPath),
  'customer by-name controller dependency graph must resolve at startup'
);

assert.doesNotMatch(controller, /lib\/prisma|prisma\./);
assert.doesNotMatch(service, /lib\/prisma|prisma\./);
assert.match(repository, /prisma\.customerProfile\.findMany/);
assert.match(repository, /name:\s*\{\s*contains:\s*query,\s*mode:\s*'insensitive'\s*\}/);
assert.match(repository, /sale:\s*\{\s*some:\s*\{\s*branchId\s*\}\s*\}/);
assert.match(repository, /take:\s*10/);

assert.match(service, /Unauthorized \(missing branchId\)/);
assert.match(service, /return \{ status: 200, body: \[\] \}/);
assert.match(controller, /เกิดข้อผิดพลาดในการค้นหาลูกค้า/);
assert.match(service, /creditLimit:/);
assert.match(service, /creditBalance:/);
assert.match(service, /customerAddress:/);

assert.doesNotMatch(
  legacyController,
  /const getCustomerByName\s*=\s*async/,
  'legacy query controller must release by-name runtime ownership'
);
assert.match(legacyController, /async function getCustomerByUserId/);

console.log('customer-query-by-name-slice.contract: PASS');
