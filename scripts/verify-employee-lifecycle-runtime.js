/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const employeeModuleRoot = path.join(root, 'src/modules/employee');

const walkJavaScriptFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkJavaScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });

const relative = (absolutePath) => path.relative(root, absolutePath).replaceAll('\\', '/');

const syntaxFiles = [
  'middlewares/verifyToken.js',
  'controllers/combinedBillingController.js',
  'controllers/branchPriceController.js',
  'routes/authRoutes.js',
  'routes/supplierPaymentRoutes.js',
  'server.js',
  'src/modules/product/create/controllers/productCreateController.js',
  'src/modules/product/quickStock/controllers/quickStockController.js',
  'src/modules/sales/return/controllers/saleReturnController.js',
  ...walkJavaScriptFiles(employeeModuleRoot).map(relative),
];

const legacyFiles = [
  'controllers/employeeController.js',
  'controllers/employeeOnboardingController.js',
  'routes/employeeRoutes.js',
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

for (const relativePath of [...new Set(syntaxFiles)]) {
  const absolutePath = path.join(root, relativePath);
  try {
    execFileSync(process.execPath, ['--check', absolutePath], { stdio: 'pipe' });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

for (const relativePath of legacyFiles) {
  if (fs.existsSync(path.join(root, relativePath))) fail(`legacy file still exists: ${relativePath}`);
  else pass(`legacy file removed: ${relativePath}`);
}

const verifyToken = read('middlewares/verifyToken.js');
assertContains(verifyToken, "'USER_DISABLED'", 'verifyToken USER_DISABLED guard');
assertContains(verifyToken, "'EMPLOYEE_PROFILE_REQUIRED'", 'verifyToken employee profile guard');
assertContains(verifyToken, "'EMPLOYEE_NOT_APPROVED'", 'verifyToken approval guard');
assertContains(verifyToken, "'EMPLOYEE_INACTIVE'", 'verifyToken active guard');
assertContains(verifyToken, 'employeeId,', 'verifyToken canonical employeeId projection');
assertContains(verifyToken, 'branchId: employeeProfile?.branchId || null', 'verifyToken DB branch projection');
assertContains(verifyToken, 'employeeRole:', 'verifyToken employeeRole projection');

const server = read('server.js');
assertContains(
  server,
  "require('./src/modules/employee/routes/employeeRoutes')",
  'server employee module route cutover',
);
assertNotContains(
  server,
  "require('./routes/employeeRoutes')",
  'server legacy employee route reference',
);

const employeeRoutes = read('src/modules/employee/routes/employeeRoutes.js');
assertContains(employeeRoutes, "router.get('/', getAllEmployees)", 'employee list route');
assertContains(employeeRoutes, "router.post('/', createEmployeeController)", 'employee create route');
assertContains(employeeRoutes, "router.get('/:id', getEmployeesById)", 'employee detail route');
assertContains(employeeRoutes, "router.put('/:id', updateEmployeeController)", 'employee update route');
assertContains(employeeRoutes, "router.patch('/:id/status', toggleEmployeeStatus)", 'employee status route');
assertContains(employeeRoutes, "router.delete('/:id', deleteEmployee)", 'employee delete compatibility route');
assertContains(employeeRoutes, 'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED', 'employee approval compatibility endpoint');
assertContains(
  employeeRoutes,
  "canonicalEndpoint: '/api/auth/add-sub-employee'",
  'canonical employee creation endpoint declaration',
);
assertNotContains(
  employeeRoutes,
  "router.post('/approve-employee', approveEmployee)",
  'live employee approval handler',
);

const authRoutes = read('routes/authRoutes.js');
assertContains(
  authRoutes,
  "require('../src/modules/employee/onboarding/onboardEmployeeController')",
  'auth route module onboarding controller',
);
assertNotContains(
  authRoutes,
  "require('../controllers/employeeOnboardingController')",
  'auth route legacy onboarding controller reference',
);
assertContains(
  authRoutes,
  "router.post('/add-sub-employee', verifyToken, addSubEmployee)",
  'canonical onboarding route guard',
);

const employeeOnboarding = read('src/modules/employee/onboarding/onboardEmployeeService.js');
assertContains(employeeOnboarding, 'canCreateEmployee', 'employee onboarding authority guard');
assertContains(employeeOnboarding, "employeeRole === 'OWNER'", 'employee onboarding OWNER authority');
assertContains(employeeOnboarding, "employeeRole === 'MANAGER'", 'employee onboarding MANAGER authority');
assertContains(employeeOnboarding, "code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'", 'employee onboarding forbidden response');
assertContains(employeeOnboarding, 'positionId,', 'employee onboarding position assignment');
assertContains(employeeOnboarding, 'v2Role,', 'employee onboarding compatibility role assignment');

const employeeOnboardingRepository = read('src/modules/employee/onboarding/onboardEmployeeRepository.js');
assertContains(employeeOnboardingRepository, 'approved: true', 'owner-created employee auto approval');
assertContains(employeeOnboardingRepository, 'active: true', 'owner-created employee auto activation');
assertContains(employeeOnboardingRepository, 'enabled: true', 'owner-created employee user activation');

const deleteController = read('src/modules/employee/delete/deleteEmployeeController.js');
assertContains(deleteController, "code: 'EMPLOYEE_HARD_DELETE_DISABLED'", 'employee hard-delete guard');
assertContains(deleteController, 'status(405)', 'employee hard-delete HTTP contract');

const combinedBilling = read('controllers/combinedBillingController.js');
assertNotContains(
  combinedBilling,
  'req.user?.employeeId || req.user?.id',
  'combined billing User.id employee fallback',
);

const productCreate = read('src/modules/product/create/controllers/productCreateController.js');
assertNotContains(productCreate, 'req.user?.activeProfileId', 'product create activeProfileId fallback');
assertNotContains(productCreate, 'req.user?.id', 'product create User.id employee fallback');

const quickStock = read('src/modules/product/quickStock/controllers/quickStockController.js');
assertNotContains(
  quickStock,
  'req.user?.employeeId || req.user?.id',
  'quick stock User.id employee fallback',
);

const branchPrice = read('controllers/branchPriceController.js');
assertNotContains(
  branchPrice,
  'toInt(req.user?.id) || toInt(req.user?.employeeId)',
  'branch price User.id updatedBy precedence',
);

const saleReturn = read('src/modules/sales/return/controllers/saleReturnController.js');
assertNotContains(
  saleReturn,
  'req.user?.employeeId || req.user?.profileId',
  'sale return profileId employee fallback',
);

const supplierPaymentRoutes = read('routes/supplierPaymentRoutes.js');
assertContains(
  supplierPaymentRoutes,
  'requireSupplierPaymentActor',
  'supplier payment actor route guard',
);

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
