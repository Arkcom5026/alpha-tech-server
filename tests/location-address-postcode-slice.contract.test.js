const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const addressRoutes = read('src/modules/location/routes/addressRoutes.js');
const locationsRoutes = read('src/modules/location/routes/locationsRoutes.js');
const controller = read('src/modules/location/address/query/postcode/addressPostcodeController.js');
const service = read('src/modules/location/address/query/postcode/addressPostcodeService.js');
const repository = read('src/modules/location/address/query/postcode/addressPostcodeRepository.js');

assert(addressRoutes.includes("require('../address/query/postcode/addressPostcodeController')"));
assert(locationsRoutes.includes("require('../address/query/postcode/addressPostcodeController')"));
assert(addressRoutes.includes("router.get('/postcode', addressPostcodeController.postcodeAddress)"));
assert(locationsRoutes.includes("router.get('/postcode', addressPostcodeController.postcodeAddress)"));
assert(!addressRoutes.includes("router.get('/postcode', addressController.postcode)"));
assert(!locationsRoutes.includes("router.get('/postcode', addressController.postcode)"));

assert(!controller.includes('prisma.'));
assert(!service.includes('prisma.'));
assert(repository.includes('prisma.subdistrict.findUnique'));
assert(repository.includes("select: { postcode: true }"));
assert(controller.includes("กรุณาระบุ subdistrictCode"));
assert(controller.includes("ไม่พบรหัสตำบล (subdistrictCode) นี้"));
assert(controller.includes("postalCode: result.postcode || null"));
assert(controller.includes("เกิดข้อผิดพลาดในการดึงรหัสไปรษณีย์"));
assert(controller.includes("เกิดข้อผิดพลาดภายในระบบ"));

assert(addressRoutes.includes("router.get('/search', addressController.search)"));
assert(addressRoutes.includes("router.post('/join', addressController.join)"));
assert(locationsRoutes.includes("router.get('/search', addressController.search)"));
assert(locationsRoutes.includes("router.post('/join', addressController.join)"));

console.log('location-address-postcode-slice.contract: PASS');
