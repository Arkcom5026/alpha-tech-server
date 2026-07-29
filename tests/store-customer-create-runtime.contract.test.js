const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(
  repoRoot,
  'src/modules/customer/controllers/customerCreateController.js'
);
const controller = fs.readFileSync(controllerPath, 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  controller.includes('const branchId = toInt(req.user?.branchId)'),
  'Create customer must derive branchId from authenticated request authority'
);
assert(
  controller.includes("Unauthorized (missing branchId)"),
  'Create customer must reject missing branch context'
);
assert(
  controller.includes('prisma.storeCustomer.findFirst'),
  'Create customer must detect an existing StoreCustomer in the current branch'
);
assert(
  controller.includes('prisma.storeCustomer.create'),
  'Create customer must create StoreCustomer'
);
assert(
  controller.includes('branchId,\n        active: true,\n        phone: normalizedPhone'),
  'Existing-customer lookup must include branchId, active=true, and normalized phone'
);
assert(
  controller.includes('branchId,\n        displayName,'),
  'StoreCustomer creation must persist authenticated branchId and displayName'
);
assert(
  controller.includes('name: customer.displayName'),
  'Response name must project StoreCustomer.displayName'
);
assert(
  controller.includes('creditBalance: 0'),
  'Response must use explicit StoreCustomer creditBalance compatibility value'
);
assert(
  !controller.includes('bcrypt'),
  'StoreCustomer creation must not hash or assign a password'
);
assert(
  !controller.includes('prisma.user'),
  'StoreCustomer creation must not query or mutate User'
);
assert(
  !controller.includes('customerProfile'),
  'StoreCustomer creation must not query or mutate CustomerProfile'
);
assert(
  !controller.includes('storeCustomerIdentityLink'),
  'StoreCustomer creation must not auto-create an identity link'
);
assert(
  controller.includes('prisma.subdistrict.findUnique'),
  'Subdistrict and postcode validation must be preserved'
);

console.log('Store customer create runtime contract: PASS');
