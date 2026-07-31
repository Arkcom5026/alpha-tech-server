/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const syntaxFiles = [
  'server.js',
  'middlewares/verifyToken.js',
  'controllers/employeeOnboardingController.js',
  'controllers/branchPriceController.js',
  'routes/authRoutes.js',
  'src/modules/procurement/supplier-payment/routes/supplierPaymentRoutes.js',
  'src/modules/employee/routes/employeeRoutes.js',
  'src/modules/employee/create/createEmployeeController.js',
  'src/modules/employee/update/updateEmployeeController.js',
  'src/modules/employee/query/list/listEmployeeController.js',
  'src/modules/employee/query/detail/detailEmployeeController.js',
  'src/modules/employee/delete/deleteEmployeeController.js',
  'src/modules/employee/status/statusEmployeeController.js',
  'src/modules/employee/role/updateEmployeeRoleController.js',
  'src/modules/employee/lookup/positions/positionLookupController.js',
  'src/modules/employee/lookup/branches/branchLookupController.js',
  'src/modules/employee/query/usersByRole/usersByRoleController.js',
  'src/modules/finance/combined-billing/query/combinable-sales/getCombinableSalesController.js',
  'src/modules/finance/combined-billing/query/detail/getCombinedBillingByIdController.js',
  'src/modules/finance/combined-billing/query/pending-customers/getCustomersWithPendingSalesController.js',
  'src/modules/product/create/controllers/productCreateController.js',
  'src/modules/product/quickStock/controllers/quickStockController.js',
  'src/modules/sales/return/controllers/saleReturnController.js',
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const pass = (message) => console.log(`PASS: ${message}`);

const assertContains = (source, value, label) => {
  if (!source.includes(value)) fail(`${label} is missing`);
  else pass(label);
};

const assertNotContains = (source, value, label) => {
  if (source.includes(value)) fail(`${label} is present`);
  else pass(label);
};

const assertMissing = (relativePath, label) => {
  if (fs.existsSync(path.join(root, relativePath))) fail(`${label} still exists`);
  else pass(label);
};

for (const relativePath of syntaxFiles) {
  const absolutePath = path.join(root, relativePath);
  try {
    execFileSync(process.execPath, ['--check', absolutePath], { stdio: 'pipe' });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

assertMissing('controllers/employeeController.js', 'legacy employee controller retired');
assertMissing('routes/employeeRoutes.js', 'legacy employee root route wrapper retired');
assertMissing('controllers/combinedBillingController.js', 'legacy combined billing controller retired');

const verifyToken = read('middlewares/verifyToken.js');
assertContains(verifyToken, "'USER_DISABLED'", 'verifyToken USER_DISABLED guard');
assertContains(verifyToken, "'EMPLOYEE_PROFILE_REQUIRED'", 'verifyToken employee profile guard');
assertContains(verifyToken, "'EMPLOYEE_NOT_APPROVED'", 'verifyToken approval guard');
assertContains(verifyToken, "'EMPLOYEE_INACTIVE'", 'verifyToken active guard');
assertContains(verifyToken, 'employeeId,', 'verifyToken canonical employeeId projection');
assertContains(verifyToken, 'branchId: employeeProfile?.branchId || null', 'verifyToken DB branch projection');
assertContains(verifyToken, 'employeeRole:', 'verifyToken employeeRole projection');

const server = read('server.js');
const employeeModuleRoute = read('src/modules/employee/routes/employeeRoutes.js');
assertContains(
  server,
  "require('./src/modules/employee/routes/employeeRoutes')",
  'server imports canonical employee module route directly'
);
assertContains(
  server,
  "app.use('/api/employees', employeeRoutes)",
  'server mounts canonical employee endpoint'
);
assertNotContains(server, 'controllers/employeeController', 'server legacy employee controller reference');
assertNotContains(server, 'controllers/combinedBillingController', 'server legacy combined billing controller reference');
assertContains(
  employeeModuleRoute,
  'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED',
  'employee approval compatibility endpoint'
);
assertContains(
  employeeModuleRoute,
  "canonicalEndpoint: '/api/auth/add-sub-employee'",
  'canonical employee creation endpoint declaration'
);
assertNotContains(
  employeeModuleRoute,
  "router.post('/approve-employee', approveEmployee)",
  'live employee approval handler'
);
assertNotContains(
  employeeModuleRoute,
  'controllers/employeeController',
  'employee module route legacy controller reference'
);

const authRoutes = read('routes/authRoutes.js');
assertContains(
  authRoutes,
  "require('../controllers/employeeOnboardingController')",
  'auth route canonical onboarding controller'
);
assertContains(
  authRoutes,
  "router.post('/add-sub-employee', verifyToken, addSubEmployee)",
  'canonical onboarding route guard'
);

const employeeOnboarding = read('controllers/employeeOnboardingController.js');
assertContains(employeeOnboarding, 'canCreateEmployee', 'employee onboarding authority guard');
assertContains(employeeOnboarding, "employeeRole === 'OWNER'", 'employee onboarding OWNER authority');
assertContains(employeeOnboarding, "employeeRole === 'MANAGER'", 'employee onboarding MANAGER authority');
assertContains(employeeOnboarding, "code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'", 'employee onboarding forbidden response');
assertContains(employeeOnboarding, 'positionId,', 'employee onboarding position assignment');
assertContains(employeeOnboarding, 'approved: true', 'owner-created employee auto approval');
assertContains(employeeOnboarding, 'active: true', 'owner-created employee auto activation');
assertContains(employeeOnboarding, 'enabled: true', 'owner-created employee user activation');

const combinedBillingControllers = [
  'src/modules/finance/combined-billing/query/combinable-sales/getCombinableSalesController.js',
  'src/modules/finance/combined-billing/query/detail/getCombinedBillingByIdController.js',
  'src/modules/finance/combined-billing/query/pending-customers/getCustomersWithPendingSalesController.js',
].map(read).join('\n');
assertNotContains(
  combinedBillingControllers,
  'req.user?.employeeId || req.user?.id',
  'combined billing User.id employee fallback'
);

const productCreate = read('src/modules/product/create/controllers/productCreateController.js');
assertNotContains(productCreate, 'req.user?.activeProfileId', 'product create activeProfileId fallback');
assertNotContains(productCreate, 'req.user?.id', 'product create User.id employee fallback');

const quickStock = read('src/modules/product/quickStock/controllers/quickStockController.js');
assertNotContains(
  quickStock,
  'req.user?.employeeId || req.user?.id',
  'quick stock User.id employee fallback'
);

const branchPrice = read('controllers/branchPriceController.js');
assertNotContains(
  branchPrice,
  'toInt(req.user?.id) || toInt(req.user?.employeeId)',
  'branch price User.id updatedBy precedence'
);

const saleReturn = read('src/modules/sales/return/controllers/saleReturnController.js');
assertNotContains(
  saleReturn,
  'req.user?.employeeId || req.user?.profileId',
  'sale return profileId employee fallback'
);

const supplierPaymentRoutes = read('src/modules/procurement/supplier-payment/routes/supplierPaymentRoutes.js');
assertContains(supplierPaymentRoutes, 'requireSupplierPaymentActor', 'supplier payment actor route guard');

const schema = read('prisma/schema.prisma');
const employeeProfileBlock = schema.match(/model\s+EmployeeProfile\s*\{[\s\S]*?\n\}/)?.[0] || '';
assertContains(employeeProfileBlock, 'onDelete: Restrict', 'EmployeeProfile.user onDelete Restrict');
assertContains(employeeProfileBlock, 'active', 'EmployeeProfile active lifecycle field');
assertContains(employeeProfileBlock, 'approved', 'EmployeeProfile approved compatibility field');
assertContains(employeeProfileBlock, 'positionId', 'EmployeeProfile position relation field');

if (process.exitCode) {
  console.error('\nEMPLOYEE LIFECYCLE VERIFICATION: FAIL');
  process.exit(process.exitCode);
}

console.log('\nEMPLOYEE LIFECYCLE VERIFICATION: PASS');
