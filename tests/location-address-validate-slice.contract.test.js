// tests/location-address-validate-slice.contract.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const addressRoutes = read('src/modules/location/routes/addressRoutes.js');
const locationsRoutes = read('src/modules/location/routes/locationsRoutes.js');
const controller = read(
  'src/modules/location/address/query/validate/addressValidateController.js'
);
const service = read(
  'src/modules/location/address/query/validate/addressValidateService.js'
);
const repository = read(
  'src/modules/location/address/query/validate/addressValidateRepository.js'
);

assert.match(
  addressRoutes,
  /addressValidateController\.validateAddress/,
  'canonical address route must use the module-owned validate controller'
);
assert.match(
  locationsRoutes,
  /addressValidateController\.validateAddress/,
  'locations alias must use the same module-owned validate controller'
);
assert.doesNotMatch(addressRoutes, /addressController\./);
assert.doesNotMatch(locationsRoutes, /addressController\./);

assert.doesNotMatch(controller, /lib\/prisma|prisma\./, 'controller must not access Prisma');
assert.doesNotMatch(service, /lib\/prisma|prisma\./, 'service must not access Prisma');
assert.match(repository, /prisma\.subdistrict\.findUnique/);
assert.match(repository, /where:\s*\{\s*code:\s*subdistrictCode\s*\}/);

assert.match(service, /กรุณาระบุ subdistrictCode/);
assert.match(service, /valid:\s*Boolean\(subdistrict\)/);
assert.match(controller, /เกิดข้อผิดพลาดในการตรวจสอบรหัสตำบล/);
assert.match(controller, /เกิดข้อผิดพลาดภายในระบบ/);

assert.match(addressRoutes, /addressPostcodeController\.postcodeAddress/);
assert.match(addressRoutes, /addressSearchController\.searchAddress/);
assert.match(addressRoutes, /addressJoinController\.joinAddress/);
assert.match(locationsRoutes, /addressPostcodeController\.postcodeAddress/);
assert.match(locationsRoutes, /addressSearchController\.searchAddress/);
assert.match(locationsRoutes, /addressJoinController\.joinAddress/);

console.log('location-address-validate-slice.contract: PASS');
