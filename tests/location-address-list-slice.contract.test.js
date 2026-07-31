const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const route = read('src/modules/location/routes/addressRoutes.js');
const controller = read('src/modules/location/address/list/addressListController.js');
const service = read('src/modules/location/address/list/addressListService.js');
const repository = read('src/modules/location/address/list/addressListRepository.js');

assert.match(route, /require\('\.\.\/address\/list\/addressListController'\)/);
assert.match(route, /router\.get\('\/provinces', addressListController\.listProvinces\)/);
assert.match(route, /router\.get\('\/districts', addressListController\.listDistricts\)/);
assert.match(route, /router\.get\('\/subdistricts', addressListController\.listSubdistricts\)/);

assert.doesNotMatch(route, /addressController\.listProvinces/);
assert.doesNotMatch(route, /addressController\.listDistricts/);
assert.doesNotMatch(route, /addressController\.listSubdistricts/);

assert.match(controller, /addressListService\.getProvinces\(\)/);
assert.match(controller, /addressListService\.getDistricts\(provinceCode\)/);
assert.match(controller, /addressListService\.getSubdistricts\(districtCode\)/);
assert.doesNotMatch(controller, /prisma\.(province|district|subdistrict)/);

assert.match(service, /addressListRepository\.listProvinces\(\)/);
assert.match(service, /addressListRepository\.listDistrictsByProvinceCode\(provinceCode\)/);
assert.match(service, /addressListRepository\.listSubdistrictsByDistrictCode\(districtCode\)/);
assert.doesNotMatch(service, /prisma\./);

assert.match(repository, /prisma\.province\.findMany/);
assert.match(repository, /prisma\.district\.findMany/);
assert.match(repository, /prisma\.subdistrict\.findMany/);
assert.match(repository, /orderBy: \{ nameTh: 'asc' \}/);
assert.match(repository, /select: \{ code: true, nameTh: true, postcode: true \}/);

assert.match(controller, /provinceCode is required/);
assert.match(controller, /districtCode is required/);

console.log('location-address-list-slice.contract: PASS');
