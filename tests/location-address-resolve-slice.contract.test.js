const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const addressRoute = read('src/modules/location/routes/addressRoutes.js');
const locationsRoute = read('src/modules/location/routes/locationsRoutes.js');
const controller = read('src/modules/location/address/query/resolve/addressResolveController.js');
const service = read('src/modules/location/address/query/resolve/addressResolveService.js');
const repository = read('src/modules/location/address/query/resolve/addressResolveRepository.js');

for (const route of [addressRoute, locationsRoute]) {
  assert.match(route, /require\('\.\.\/address\/query\/resolve\/addressResolveController'\)/);
  assert.match(route, /router\.get\('\/resolve', addressResolveController\.resolveAddress\)/);
  assert.match(route, /addressValidateController\.validateAddress/);
  assert.match(route, /addressPostcodeController\.postcodeAddress/);
  assert.match(route, /addressSearchController\.searchAddress/);
  assert.match(route, /addressJoinController\.joinAddress/);
  assert.doesNotMatch(route, /addressController\./);
}

assert.doesNotMatch(controller, /prisma\./);
assert.doesNotMatch(service, /prisma\./);
assert.doesNotMatch(service, /addressUtil|utils\/address/);
assert.match(repository, /prisma\.subdistrict\.findUnique/);
assert.match(repository, /include: \{ district: \{ include: \{ province: true \} \} \}/);

assert.match(controller, /กรุณาระบุ subdistrictCode/);
assert.match(controller, /ไม่พบรหัสตำบล \(subdistrictCode\) นี้/);
assert.match(controller, /เกิดข้อผิดพลาดในการดึงข้อมูลที่อยู่/);
assert.match(controller, /เกิดข้อผิดพลาดภายในระบบ/);

assert.match(service, /postalCode: postalCode \|\| subdistrict\.postcode \|\| undefined/);
assert.match(service, /if \(address \|\| result\.postalCode\)/);
assert.match(service, /joinAddressParts/);
assert.match(service, /\[address, subdistrict, district, province, postalCode\]\.filter\(Boolean\)\.join\(' '\)/);
assert.match(service, /provinceCode: subdistrict\.district\?\.provinceCode/);
assert.match(service, /districtCode: subdistrict\.district\?\.code/);
assert.match(service, /subdistrictCode: subdistrict\.code/);
assert.match(service, /subdistrictName: subdistrict\.nameTh/);
assert.match(service, /districtName: subdistrict\.district\?\.nameTh/);
assert.match(service, /provinceName: subdistrict\.district\?\.province\?\.nameTh/);
assert.match(service, /region: subdistrict\.district\?\.province\?\.region \|\| undefined/);

console.log('location-address-resolve-slice.contract: PASS');
