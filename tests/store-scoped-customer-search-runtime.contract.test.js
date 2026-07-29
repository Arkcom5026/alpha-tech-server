const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(
  repoRoot,
  'src/modules/customer/controllers/customerQueryController.js'
);
const schemaPath = path.join(repoRoot, 'prisma/schema.prisma');

const controller = fs.readFileSync(controllerPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(
  controller.includes('prisma.storeCustomer.findFirst'),
  'Phone search must query prisma.storeCustomer.findFirst'
);
assert(
  controller.includes('prisma.storeCustomer.findMany'),
  'Name search must query prisma.storeCustomer.findMany'
);
assert(
  controller.includes('branchId,\n        active: true,\n        phone,'),
  'Phone search must require branchId, active=true, and phone'
);
assert(
  controller.includes("displayName: { contains: q, mode: 'insensitive' }"),
  'Name search must query StoreCustomer.displayName'
);
assert(
  controller.includes('name: customer.displayName'),
  'Response name must project StoreCustomer.displayName'
);
assert(
  controller.includes('creditBalance: 0'),
  'StoreCustomer search must use explicit creditBalance compatibility value'
);

const phoneHandler = controller.slice(
  controller.indexOf('const getCustomerByPhone'),
  controller.indexOf('const getCustomerByName')
);
const nameHandler = controller.slice(
  controller.indexOf('const getCustomerByName'),
  controller.indexOf('async function getCustomerByUserId')
);

assert(
  !phoneHandler.includes('customerProfile'),
  'Phone search must not fall back to CustomerProfile'
);
assert(
  !nameHandler.includes('customerProfile'),
  'Name search must not fall back to CustomerProfile'
);
assert(
  controller.includes('prisma.customerProfile.findUnique'),
  '/api/customers/me must remain on legacy CustomerProfile in this increment'
);
assert(
  schema.includes('model StoreCustomer {'),
  'StoreCustomer Prisma foundation must exist on the selected baseline'
);
assert(
  schema.includes('@@index([branchId, phone])'),
  'StoreCustomer must retain the branchId + phone search index'
);
assert(
  schema.includes('@@index([branchId, displayName])'),
  'StoreCustomer must retain the branchId + displayName search index'
);

console.log('Store-scoped customer search runtime contract: PASS');
