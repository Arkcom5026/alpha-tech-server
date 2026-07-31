const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requireFromRoot = (relativePath) => require(path.join(root, relativePath));

const routes = requireFromRoot('src/modules/customer/routes/customerRoutes.js');
const controller = requireFromRoot(
  'src/modules/customer/update/self/customerSelfUpdateController.js'
);
const service = requireFromRoot('src/modules/customer/update/self/customerSelfUpdateService.js');
const repository = requireFromRoot(
  'src/modules/customer/update/self/customerSelfUpdateRepository.js'
);

assert(routes, 'customer routes must resolve');
assert.strictEqual(typeof controller.updateCustomerSelf, 'function');
assert.strictEqual(typeof service.updateCustomerSelf, 'function');
assert.strictEqual(typeof repository.findSubdistrictPostcode, 'function');
assert.strictEqual(typeof repository.findCustomerByUserId, 'function');
assert.strictEqual(typeof repository.updateCustomerSelf, 'function');
assert.strictEqual(typeof repository.findCustomerDetailById, 'function');

const legacyPath = path.join(
  root,
  'src/modules/customer/controllers/customerUpdateController.js'
);
assert.strictEqual(
  fs.existsSync(legacyPath),
  false,
  'legacy customer update controller must be retired after self-update migration'
);

console.log('customer-self-update-slice.contract: PASS');
