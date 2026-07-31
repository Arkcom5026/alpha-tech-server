const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const route = read('src/modules/customer/routes/customerRoutes.js');
const legacyController = read('src/modules/customer/controllers/customerQueryController.js');
const controller = read(
  'src/modules/customer/query/by-phone/customerByPhoneController.js'
);
const service = read(
  'src/modules/customer/query/by-phone/customerByPhoneService.js'
);
const repository = read(
  'src/modules/customer/query/by-phone/customerByPhoneRepository.js'
);

assert.match(
  route,
  /require\('\.\.\/query\/by-phone\/customerByPhoneController'\)/
);
assert.match(route, /router\.get\('\/by-phone\/:phone', customerByPhoneController\.getCustomerByPhone\)/);
assert.doesNotMatch(route, /router\.get\('\/by-phone\/:phone', getCustomerByPhone\)/);

assert.doesNotMatch(controller, /lib\/prisma|prisma\./);
assert.doesNotMatch(service, /lib\/prisma|prisma\./);
assert.match(repository, /prisma\.customerProfile\.findFirst/);
assert.match(repository, /user:\s*\{\s*loginId:\s*phone\s*\}/);
assert.match(repository, /sale:\s*\{\s*some:\s*\{\s*branchId\s*\}\s*\}/);

assert.match(service, /Unauthorized \(missing branchId\)/);
assert.match(service, /รูปแบบเบอร์โทรไม่ถูกต้อง/);
assert.match(service, /ไม่พบลูกค้า/);
assert.match(controller, /เกิดข้อผิดพลาดในการค้นหาลูกค้า/);
assert.match(service, /creditLimit:/);
assert.match(service, /creditBalance:/);
assert.match(service, /customerAddress:/);

assert.doesNotMatch(
  legacyController,
  /const getCustomerByPhone\s*=\s*async/,
  'legacy query controller must release by-phone runtime ownership'
);
assert.match(legacyController, /const getCustomerByName\s*=\s*async/);
assert.match(legacyController, /async function getCustomerByUserId/);

console.log('customer-query-by-phone-slice.contract: PASS');
