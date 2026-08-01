/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const syntaxFiles = [
  'server.js',
  'middlewares/verifyToken.js',
  'src/modules/auth/routes/sessionAuthRoutes.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeController.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeService.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeRepository.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeController.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js',
  'controllers/branchPriceController.js',
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
assertMissing(
  'controllers/combinedBillingController.js',
  'legacy combined billing controller retired'
);
assertMissing('controllers/authController.js', 'legacy root auth controller retired');
assertMissing('routes/authRoutes.js', 'legacy root auth route retired');
assertMissing('routes/loginEmployee.js', 'legacy loginEmployee route retired');
assertMissing('routes/currentEmployeeRoutes.js', 'legacy currentEmployee route retired');
assertMissing(
  'controllers/employeeOnboardingController.js',
  'legacy root employee onboarding controller retired'
);

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
const sessionAuthRoutes = read('src/modules/auth/routes/sessionAuthRoutes.js');
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
assertContains(
  server,
  "require('./src/modules/auth/routes/sessionAuthRoutes')",
  'server imports canonical session auth module route directly'
);
assertContains(
  server,
  "app.use('/api/auth', authRoutes)",
  'server mounts canonical auth endpoint'
);
assertNotContains(
  server,
  "require('./routes/authRoutes')",
  'server legacy auth route import'
);
assertNotContains(
  server,
  'controllers/employeeController',
  'server legacy employee controller reference'
);
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

assertContains(
  sessionAuthRoutes,
  "require('../../employee/onboarding/runtime/employeeOnboardingRuntimeController')",
  'session auth route module onboarding boundary'
);
assertContains(
  sessionAuthRoutes,
  "router.post('/add-sub-employee', verifyToken, addSubEmployee)",
  'canonical onboarding route guard'
);
assertNotContains(
  sessionAuthRoutes,
  "require('../../../../controllers/authController')",
  'session auth route legacy auth controller reference'
);
assertNotContains(
  sessionAuthRoutes,
  'controllers/employeeOnboardingController',
  'session auth route legacy onboarding controller reference'
);

const employeeOnboardingController = read(
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeController.js'
);
const employeeOnboardingService = read(
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js'
);
const employeeOnboardingRepository = read(
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js'
);
assertContains(
  employeeOnboardingController,
  "require('./employeeOnboardingRuntimeService')",
  'employee onboarding controller service boundary'
);
assertContains(
  employeeOnboardingController,
  'addSubEmployee: service.addSubEmployee',
  'employee onboarding controller handler export'
);
assertContains(employeeOnboardingService, 'canCreateEmployee', 'employee onboarding authority guard');
assertContains(employeeOnboardingService, "employeeRole === 'OWNER'", 'employee onboarding OWNER authority');
assertContains(employeeOnboardingService, "employeeRole === 'MANAGER'", 'employee onboarding MANAGER authority');
assertContains(
  employeeOnboardingService,
  "code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'",
  'employee onboarding forbidden response'
);
assertContains(employeeOnboardingService, 'positionId,', 'employee onboarding position assignment');
assertContains(employeeOnboardingService, 'approved: true', 'owner-created employee auto approval');
assertContains(employeeOnboardingService, 'active: true', 'owner-created employee auto activation');
assertContains(employeeOnboardingService, 'enabled: true', 'owner-created employee user activation');
assertContains(
  employeeOnboardingService,
  "require('./employeeOnboardingRuntimeRepository')",
  'employee onboarding service repository boundary'
);
assertContains(
  employeeOnboardingRepository,
  'const runTransaction = (work) => prisma.$transaction(work);',
  'employee onboarding repository transaction boundary'
);
assertNotContains(
  employeeOnboardingService,
  'controllers/employeeOnboardingController',
  'employee onboarding service legacy controller reference'
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
assertContains(
  supplierPaymentRoutes,
  'requireSupplierPaymentActor',
  'supplier payment actor route guard'
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

