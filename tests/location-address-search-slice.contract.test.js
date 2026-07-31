const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const addressRoutes = read('src/modules/location/routes/addressRoutes.js');
const locationsRoutes = read('src/modules/location/routes/locationsRoutes.js');
const controller = read('src/modules/location/address/query/search/addressSearchController.js');
const service = read('src/modules/location/address/query/search/addressSearchService.js');
const repository = read('src/modules/location/address/query/search/addressSearchRepository.js');

assert.match(addressRoutes, /addressSearchController/);
assert.match(locationsRoutes, /addressSearchController/);
assert.match(addressRoutes, /router\.get\('\/search', addressSearchController\.searchAddress\)/);
assert.match(locationsRoutes, /router\.get\('\/search', addressSearchController\.searchAddress\)/);
assert.doesNotMatch(addressRoutes, /addressController\.search/);
assert.doesNotMatch(locationsRoutes, /addressController\.search/);

assert.match(controller, /addressSearchService\.searchAddresses/);
assert.doesNotMatch(controller, /prisma\.(province|district|subdistrict)/);
assert.match(service, /addressSearchRepository\.searchAddressEntities/);
assert.doesNotMatch(service, /prisma\.(province|district|subdistrict)/);

assert.match(repository, /prisma\.province\.findMany/);
assert.match(repository, /prisma\.district\.findMany/);
assert.match(repository, /prisma\.subdistrict\.findMany/);
assert.match(repository, /mode: 'insensitive'/);
assert.match(repository, /take: 10/);
assert.match(repository, /orderBy: \{ nameTh: 'asc' \}/);

assert.match(service, /query\.length < 2/);
assert.match(service, /provinces: \[\], districts: \[\], subdistricts: \[\]/);
assert.match(controller, /เกิดข้อผิดพลาดในการค้นหาที่อยู่/);
assert.match(controller, /เกิดข้อผิดพลาดภายในระบบ/);

console.log('location-address-search-slice.contract: PASS');
