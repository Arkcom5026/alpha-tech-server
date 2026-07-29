const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(
  repoRoot,
  'src/modules/customer/controllers/customerUpdateController.js'
);

const controller = fs.readFileSync(controllerPath, 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const staffHandler = controller.slice(
  controller.indexOf('const updateCustomerProfile ='),
  controller.indexOf('const updateCustomerProfileOnline =')
);
const onlineHandler = controller.slice(
  controller.indexOf('const updateCustomerProfileOnline ='),
  controller.indexOf('module.exports')
);

assert(
  staffHandler.includes('const branchId = toInt(userContext.branchId);'),
  'Staff update must derive branchId from authenticated context'
);
assert(
  staffHandler.includes("Unauthorized (missing branchId)"),
  'Staff update must reject a missing branchId'
);
assert(
  staffHandler.includes('prisma.storeCustomer.findFirst'),
  'Staff update must resolve the target through StoreCustomer'
);
assert(
  staffHandler.includes('id,\n        branchId,\n        active: true,'),
  'Staff update lookup must include id, branchId, and active=true'
);
assert(
  staffHandler.includes('prisma.storeCustomer.update'),
  'Staff update must mutate StoreCustomer'
);
assert(
  staffHandler.includes('displayName: sanitize(name)'),
  'Legacy name input must map to StoreCustomer.displayName'
);
assert(
  staffHandler.includes('phone: sanitizedPhone'),
  'Phone changes must update StoreCustomer.phone'
);
assert(
  !staffHandler.includes('customerProfile'),
  'Staff update must not query or mutate CustomerProfile'
);
assert(
  !staffHandler.includes('tx.user.update'),
  'Staff update must not mutate User.loginId'
);
assert(
  !staffHandler.includes('prisma.user'),
  'Staff update must not access Platform User authority'
);
assert(
  staffHandler.includes('validateSubdistrictPostcode'),
  'Subdistrict/Postcode validation must remain in staff update'
);
assert(
  controller.includes('creditBalance: 0'),
  'StoreCustomer response must use explicit creditBalance compatibility value'
);
assert(
  onlineHandler.includes('prisma.customerProfile.findUnique'),
  '/api/customers/me must remain on CustomerProfile in this increment'
);
assert(
  onlineHandler.includes('tx.user.update'),
  'Existing /me identity behavior must remain unchanged in this increment'
);

console.log('Store customer update runtime contract: PASS');
