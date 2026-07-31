const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');

function requireFromRoot(relativePath) {
  return require(path.join(root, relativePath));
}

const routes = requireFromRoot('src/modules/customer/routes/customerRoutes.js');
const controller = requireFromRoot(
  'src/modules/customer/update/staff/customerStaffUpdateController.js'
);
const service = requireFromRoot('src/modules/customer/update/staff/customerStaffUpdateService.js');
const repository = requireFromRoot(
  'src/modules/customer/update/staff/customerStaffUpdateRepository.js'
);
const legacyController = requireFromRoot(
  'src/modules/customer/controllers/customerUpdateController.js'
);

assert(routes, 'customer routes must resolve');
assert.strictEqual(typeof controller.updateCustomerStaff, 'function');
assert.strictEqual(typeof service.updateCustomerStaff, 'function');
assert.strictEqual(typeof repository.findCustomerById, 'function');
assert.strictEqual(typeof repository.findSubdistrictPostcode, 'function');
assert.strictEqual(typeof repository.updateCustomer, 'function');
assert.strictEqual(
  legacyController.updateCustomerProfile,
  undefined,
  'legacy controller must no longer export staff update ownership'
);
assert.strictEqual(
  typeof legacyController.updateCustomerProfileOnline,
  'function',
  'legacy controller must temporarily retain customer self update ownership'
);

console.log('customer-staff-update-slice.contract: PASS');
