const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const addressRoutes = read('src/modules/location/routes/addressRoutes.js');
const locationsRoutes = read('src/modules/location/routes/locationsRoutes.js');
const controller = read('src/modules/location/address/command/join/addressJoinController.js');
const service = read('src/modules/location/address/command/join/addressJoinService.js');
const repository = read('src/modules/location/address/command/join/addressJoinRepository.js');

assert.match(addressRoutes, /addressJoinController/);
assert.match(addressRoutes, /router\.post\('\/join', addressJoinController\.joinAddress\)/);
assert.match(locationsRoutes, /addressJoinController/);
assert.match(locationsRoutes, /router\.post\('\/join', addressJoinController\.joinAddress\)/);
assert.doesNotMatch(addressRoutes, /addressController\.join/);
assert.doesNotMatch(locationsRoutes, /addressController\.join/);

assert.match(controller, /addressJoinService\.joinAddressBySubdistrictCode/);
assert.match(controller, /กรุณาระบุ subdistrictCode/);
assert.match(controller, /ไม่พบรหัสตำบล \(subdistrictCode\) นี้/);
assert.match(controller, /เกิดข้อผิดพลาดในการรวมที่อยู่/);
assert.match(controller, /return res\.json\(\{ address: joinedAddress \}\)/);

assert.match(service, /addressJoinRepository\.findAddressBySubdistrictCode/);
assert.match(service, /\[address, subdistrict, district, province, postalCode\]\.filter\(Boolean\)\.join\(' '\)/);
assert.match(repository, /prisma\.subdistrict\.findUnique/);
assert.match(repository, /include: \{ district: \{ include: \{ province: true \} \} \}/);

console.log('location-address-join-slice.contract: PASS');
