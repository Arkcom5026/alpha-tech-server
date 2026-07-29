const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const controller = fs.readFileSync(
  path.join(repoRoot, 'src/modules/customer/controllers/customerQueryController.js'),
  'utf8'
);
const routes = fs.readFileSync(
  path.join(repoRoot, 'src/modules/customer/routes/customerRoutes.js'),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const searchHandler = controller.slice(
  controller.indexOf('const searchStoreCustomers ='),
  controller.indexOf('async function getCustomerByUserId')
);

assert(routes.includes("router.get('/search', searchStoreCustomers);"), 'Unified search route must exist');
assert(
  routes.indexOf("router.get('/search', searchStoreCustomers);") < routes.indexOf("router.put('/:id'"),
  'Unified search route must be registered before parameter routes'
);
assert(
  searchHandler.includes('const branchId = toInt(req.user?.branchId);'),
  'Search must derive branchId from authenticated context'
);
assert(
  searchHandler.includes("Unauthorized (missing branchId)"),
  'Search must reject missing branchId'
);
assert(
  searchHandler.includes('prisma.storeCustomer.findMany'),
  'Search must query StoreCustomer'
);
assert(
  searchHandler.includes('branchId,\n        active: true,'),
  'Search must enforce branchId and active=true'
);
assert(
  searchHandler.includes("{ phone: { contains: compactDigits } }"),
  'Numeric search must support partial phone lookup'
);
assert(
  searchHandler.includes("{ taxId: { contains: compactDigits } }"),
  'Numeric search must support tax ID lookup'
);
assert(
  searchHandler.includes("displayName: { contains: q, mode: 'insensitive' }"),
  'Text search must support display name lookup'
);
assert(
  searchHandler.includes("companyName: { contains: q, mode: 'insensitive' }"),
  'Text search must support company name lookup'
);
assert(
  searchHandler.includes('compactDigits.length < 4'),
  'Numeric search must require at least four digits'
);
assert(
  searchHandler.includes('q.length < 2'),
  'Text search must require at least two characters'
);
assert(searchHandler.includes('take: 20'), 'Unified search must cap results at 20');
assert(searchHandler.includes('phone.endsWith(compactDigits)'), 'Phone suffix matches must be ranked');
assert(searchHandler.includes('displayName.startsWith(normalizedQuery)'), 'Name prefix matches must be ranked');
assert(!searchHandler.includes('repair'), 'Customer search must not import Repair concerns');
assert(!searchHandler.includes('device'), 'Customer search must not search devices');
assert(!searchHandler.includes('serial'), 'Customer search must not search serial numbers');
assert(!searchHandler.includes('claim'), 'Customer search must not search claims');
assert(!searchHandler.includes('customerProfile'), 'Unified staff search must not query CustomerProfile');

console.log('Unified store customer search runtime contract: PASS');
