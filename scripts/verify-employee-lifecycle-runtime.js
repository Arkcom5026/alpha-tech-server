/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readPrismaSchemaSource } = require('./read-prisma-schema-source');

const root = path.resolve(__dirname, '..');

const syntaxFiles = [
  'server.js',
  'middlewares/verifyToken.js',
  'src/modules/auth/routes/sessionAuthRoutes.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeController.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeService.js',
  'src/modules/auth/session/runtime/sessionAuthRuntimeRepository.js',
  'src/modules/employee/authorization/employeePositionAuthority.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeController.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js',
  'src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js',
  'src/modules/product/pricing/routes/branchPriceRoutes.js',
  'src/modules/product/pricing/runtime/branchPriceRuntimeController.js',
  'src/modules/product/pricing/runtime/branchPriceRuntimeService.js',
  'src/modules/product/pricing/runtime/branchPriceRuntimeRepository.js',
  'src/modules/branch/routes/branchRoutes.js',
  'src/modules/branch/runtime/branchRuntimeController.js',
  'src/modules/branch/runtime/branchRuntimeService.js',
  'src/modules/branch/runtime/branchRuntimeRepository.js',
  'src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js',
  'src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeController.js',
  'src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeService.js',
  'src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeRepository.js',
  'src/modules/finance/routes/financeRuntimeRoutes.js',
  'src/modules/finance/runtime/financeRuntimeController.js',
  'src/modules/finance/runtime/financeRuntimeService.js',
  'src/modules/finance/runtime/financeRuntimeRepository.js',
  'src/modules/unit/routes/unitRoutes.js',
  'src/modules/unit/runtime/unitRuntimeController.js',
  'src/modules/unit/runtime/unitRuntimeService.js',
  'src/modules/unit/runtime/unitRuntimeRepository.js',
  'src/modules/position/routes/positionRoutes.js',
  'src/modules/position/runtime/positionRuntimeController.js',
  'src/modules/position/runtime/positionRuntimeService.js',
  'src/modules/position/runtime/positionRuntimeRepository.js',
  'src/modules/category/routes/categoryRoutes.js',
  'src/modules/category/runtime/categoryRuntimeController.js',
  'src/modules/category/runtime/categoryRuntimeService.js',
  'src/modules/category/runtime/categoryRuntimeRepository.js',
  'src/modules/productTemplate/routes/productTemplateRoutes.js',
  'src/modules/productTemplate/runtime/productTemplateRuntimeController.js',
  'src/modules/productTemplate/runtime/productTemplateRuntimeService.js',
  'src/modules/productTemplate/runtime/productTemplateRuntimeRepository.js',
  'src/modules/brand/routes/brandRoutes.js',
  'src/modules/brand/routes/productTypeBrandRoutes.js',
  'src/modules/brand/runtime/brandRuntimeController.js',
  'src/modules/brand/runtime/brandRuntimeService.js',
  'src/modules/brand/runtime/brandRuntimeRepository.js',
  'src/modules/product/profile/routes/productProfileRoutes.js',
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

const retiredRootFiles = [
  ['controllers/employeeController.js', 'legacy employee controller retired'],
  ['routes/employeeRoutes.js', 'legacy employee root route wrapper retired'],
  ['controllers/combinedBillingController.js', 'legacy combined billing controller retired'],
  ['controllers/authController.js', 'legacy root auth controller retired'],
  ['routes/authRoutes.js', 'legacy root auth route retired'],
  ['routes/loginEmployee.js', 'legacy loginEmployee route retired'],
  ['routes/currentEmployeeRoutes.js', 'legacy currentEmployee route retired'],
  ['controllers/employeeOnboardingController.js', 'legacy root employee onboarding controller retired'],
  ['controllers/branchPriceController.js', 'legacy root branch price controller retired'],
  ['controllers/branchController.js', 'legacy root branch controller retired'],
  ['controllers/inputTaxReportController.js', 'legacy root input tax report controller retired'],
  ['controllers/financeController.js', 'legacy root finance controller retired'],
  ['controllers/productTypeController.js', 'legacy root product type controller retired'],
  ['controllers/brandController.js', 'legacy root brand controller retired'],
  ['controllers/productTypeBrandController.js', 'legacy root product type brand controller retired'],
  ['controllers/stockAuditController.js', 'legacy root stock audit controller retired'],
  ['controllers/receiptSimpleController.js', 'legacy root receipt simple controller retired'],
  ['controllers/superAdminCategoryController.js', 'legacy root super admin category controller retired'],
  ['routes/productRoutes.js', 'legacy root product route wrapper retired'],
  ['routes/productTypeRoutes.js', 'legacy root product type route retired'],
  ['routes/brandRoutes.js', 'legacy root brand route retired'],
  ['routes/catalogRoutes.js', 'legacy root catalog route retired'],
  ['routes/taxReportRoutes.js', 'legacy root tax report route retired'],
  ['src/modules/auth/controllers/authController.js', 'obsolete module auth controller retired'],
  ['src/modules/auth/services/authService.js', 'obsolete module auth service retired'],
  ['src/modules/unit/controllers/unitController.js', 'legacy unit controller retired'],
  ['src/modules/position/controllers/positionController.js', 'legacy position controller retired'],
  ['src/modules/category/controllers/categoryController.js', 'legacy category controller retired'],
  ['src/modules/productTemplate/controllers/productTemplateController.js', 'legacy product template controller retired'],
  ['src/modules/brand/controllers/brandController.js', 'legacy brand module controller retired'],
  ['src/modules/product/profile/controllers/productProfileController.js', 'redundant product profile controller retired'],
  ['src/modules/finance/legacy-runtime/routes/financeRuntimeRoutes.js', 'legacy finance runtime route retired'],
  ['src/modules/finance/legacy-runtime/financeRuntimeController.js', 'legacy finance runtime controller retired'],
  ['src/modules/finance/legacy-runtime/financeRuntimeService.js', 'legacy finance runtime service retired'],
  ['src/modules/finance/legacy-runtime/financeRuntimeRepository.js', 'legacy finance runtime repository retired'],
  ['src/modules/finance/legacy-runtime/financeRuntimeSlice.test.js', 'legacy finance runtime test retired'],
  ['src/modules/finance/routes/financeRoutes.js', 'duplicate finance route retired'],
  ['src/modules/finance/controllers/financeController.js', 'duplicate finance controller retired'],
  ['src/modules/finance/services/financeService.js', 'duplicate finance service retired'],
  ['src/features/finance/dailyClosing.routes.js', 'legacy daily closing route retired'],
  ['src/features/finance/financeRoutes.js', 'legacy feature finance bridge retired'],
  ['src/modules/product/controllers/templateProductSearchController.js', 'duplicate template product search controller retired'],
  ['src/modules/product/services/templateProductSearchService.js', 'duplicate template product search service retired'],
  ['src/modules/product/repositories/productTemplateRepository.js', 'duplicate template product search repository retired'],
];

for (const [relativePath, label] of retiredRootFiles) assertMissing(relativePath, label);

const verifyToken = read('middlewares/verifyToken.js');
assertContains(verifyToken, "'USER_DISABLED'", 'verifyToken USER_DISABLED guard');
assertContains(verifyToken, "'EMPLOYEE_PROFILE_REQUIRED'", 'verifyToken employee profile guard');
assertContains(verifyToken, "'EMPLOYEE_NOT_APPROVED'", 'verifyToken approval guard');
assertContains(verifyToken, "'EMPLOYEE_INACTIVE'", 'verifyToken active guard');
assertContains(verifyToken, 'employeeId,', 'verifyToken canonical employeeId projection');
assertContains(verifyToken, 'branchId: employeeProfile?.branchId || null', 'verifyToken DB branch projection');
assertContains(verifyToken, 'employeeRole:', 'verifyToken employeeRole compatibility projection');
assertContains(verifyToken, 'positionCapabilities:', 'verifyToken position capability projection');

const server = read('server.js');
const employeeModuleRoute = read('src/modules/employee/routes/employeeRoutes.js');
const sessionAuthRoutes = read('src/modules/auth/routes/sessionAuthRoutes.js');
const branchPriceRoute = read('src/modules/product/pricing/routes/branchPriceRoutes.js');
const branchRoute = read('src/modules/branch/routes/branchRoutes.js');
const inputTaxRoute = read('src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js');
const financeRoute = read('src/modules/finance/routes/financeRuntimeRoutes.js');
const unitRoute = read('src/modules/unit/routes/unitRoutes.js');
const positionRoute = read('src/modules/position/routes/positionRoutes.js');
const categoryRoute = read('src/modules/category/routes/categoryRoutes.js');
const productTemplateRoute = read('src/modules/productTemplate/routes/productTemplateRoutes.js');
const brandRoute = read('src/modules/brand/routes/brandRoutes.js');
const productTypeBrandRoute = read('src/modules/brand/routes/productTypeBrandRoutes.js');
const productProfileRoute = read('src/modules/product/profile/routes/productProfileRoutes.js');

assertContains(server, "require('./src/modules/employee/routes/employeeRoutes')", 'server imports canonical employee module route directly');
assertContains(server, "app.use('/api/employees', employeeRoutes)", 'server mounts canonical employee endpoint');
assertContains(server, "require('./src/modules/auth/routes/sessionAuthRoutes')", 'server imports canonical session auth module route directly');
assertContains(server, "app.use('/api/auth', authRoutes)", 'server mounts canonical auth endpoint');
assertContains(server, "require('./src/modules/finance/routes/financeRuntimeRoutes')", 'server imports canonical finance route directly');
assertContains(server, "app.use('/api/finance', financeRoutes)", 'server mounts canonical finance endpoint');
assertNotContains(server, "require('./routes/authRoutes')", 'server legacy auth route import');
assertNotContains(server, 'controllers/employeeController', 'server legacy employee controller reference');
assertNotContains(server, 'legacy-runtime', 'server legacy-runtime reference');

assertContains(employeeModuleRoute, 'EMPLOYEE_APPROVAL_WORKFLOW_DEPRECATED', 'employee approval compatibility endpoint');
assertContains(employeeModuleRoute, "canonicalEndpoint: '/api/auth/add-sub-employee'", 'canonical employee creation endpoint declaration');
assertNotContains(employeeModuleRoute, "router.post('/approve-employee', approveEmployee)", 'live employee approval handler');
assertNotContains(employeeModuleRoute, 'controllers/employeeController', 'employee module route legacy controller reference');

assertContains(sessionAuthRoutes, "require('../../employee/onboarding/runtime/employeeOnboardingRuntimeController')", 'session auth route module onboarding boundary');
assertContains(sessionAuthRoutes, "router.post('/add-sub-employee', verifyToken, addSubEmployee)", 'canonical onboarding route guard');
assertNotContains(sessionAuthRoutes, "require('../../../../controllers/authController')", 'session auth route legacy auth controller reference');
assertNotContains(sessionAuthRoutes, 'controllers/employeeOnboardingController', 'session auth route legacy onboarding controller reference');

assertContains(branchPriceRoute, "require('../runtime/branchPriceRuntimeController')", 'branch price route runtime boundary');
assertNotContains(branchPriceRoute, 'controllers/branchPriceController', 'branch price route legacy controller reference');
assertContains(branchRoute, "require('../runtime/branchRuntimeController')", 'branch route runtime boundary');
assertNotContains(branchRoute, 'controllers/branchController', 'branch route legacy controller reference');
assertContains(inputTaxRoute, "require('../runtime/inputTaxReportRuntimeController')", 'input tax route runtime boundary');
assertNotContains(inputTaxRoute, 'controllers/inputTaxReportController', 'input tax route legacy controller reference');
assertContains(financeRoute, "require('../runtime/financeRuntimeController')", 'finance route runtime boundary');
assertNotContains(financeRoute, 'legacy-runtime', 'finance route legacy-runtime reference');
assertContains(unitRoute, "require('../runtime/unitRuntimeController')", 'unit route runtime boundary');
assertContains(positionRoute, "require('../runtime/positionRuntimeController')", 'position route runtime boundary');
assertContains(categoryRoute, "require('../runtime/categoryRuntimeController')", 'category route runtime boundary');
assertContains(productTemplateRoute, "require('../runtime/productTemplateRuntimeController')", 'product template route runtime boundary');
assertContains(brandRoute, "require('../runtime/brandRuntimeController')", 'brand route runtime boundary');
assertContains(productTypeBrandRoute, "require('../runtime/brandRuntimeController')", 'product type brand compatibility runtime boundary');
assertContains(productProfileRoute, "code: 'PRODUCT_PROFILE_REMOVED'", 'product profile retirement boundary');
assertNotContains(productProfileRoute, 'productProfileController', 'product profile redundant controller reference');

const employeePositionAuthority = read('src/modules/employee/authorization/employeePositionAuthority.js');
const employeeOnboardingController = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeController.js');
const employeeOnboardingService = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeService.js');
const employeeOnboardingRepository = read('src/modules/employee/onboarding/runtime/employeeOnboardingRuntimeRepository.js');
assertContains(employeeOnboardingController, "require('./employeeOnboardingRuntimeService')", 'employee onboarding controller service boundary');
assertContains(employeeOnboardingController, 'addSubEmployee: service.addSubEmployee', 'employee onboarding controller handler export');
assertContains(employeeOnboardingService, 'canCreateEmployee', 'employee onboarding authority guard');
assertContains(employeeOnboardingService, 'POSITION_CAPABILITIES.EMPLOYEE_MANAGE', 'employee onboarding position capability authority');
assertContains(employeeOnboardingService, 'hasCapability(actor, POSITION_CAPABILITIES.EMPLOYEE_MANAGE)', 'employee onboarding centralized capability guard');
assertContains(employeePositionAuthority, "mode: 'V2_ROLE_COMPAT'", 'employee onboarding v2Role compatibility fallback');
assertContains(employeePositionAuthority, "normalized === 'OWNER' || normalized === 'MANAGER'", 'employee onboarding legacy role compatibility');
assertContains(employeeOnboardingService, "code: 'EMPLOYEE_ONBOARDING_FORBIDDEN'", 'employee onboarding forbidden response');
assertContains(employeeOnboardingService, 'positionId,', 'employee onboarding position assignment');
assertContains(employeeOnboardingService, 'approved: true', 'owner-created employee auto approval');
assertContains(employeeOnboardingService, 'active: true', 'owner-created employee auto activation');
assertContains(employeeOnboardingService, 'enabled: true', 'owner-created employee user activation');
assertContains(employeeOnboardingService, "require('./employeeOnboardingRuntimeRepository')", 'employee onboarding service repository boundary');
assertContains(employeeOnboardingRepository, 'const runTransaction = (work) => prisma.$transaction(work);', 'employee onboarding repository transaction boundary');
assertNotContains(employeeOnboardingService, 'controllers/employeeOnboardingController', 'employee onboarding service legacy controller reference');

const productCreate = read('src/modules/product/create/controllers/productCreateController.js');
assertNotContains(productCreate, 'req.user?.activeProfileId', 'product create activeProfileId fallback');
assertNotContains(productCreate, 'req.user?.id', 'product create User.id employee fallback');

const quickStock = read('src/modules/product/quickStock/controllers/quickStockController.js');
assertNotContains(quickStock, 'req.user?.employeeId || req.user?.id', 'quick stock User.id employee fallback');

const branchPriceController = read('src/modules/product/pricing/runtime/branchPriceRuntimeController.js');
assertNotContains(branchPriceController, 'toInt(req.user?.id) || toInt(req.user?.employeeId)', 'branch price User.id updatedBy precedence');

const saleReturn = read('src/modules/sales/return/controllers/saleReturnController.js');
assertNotContains(saleReturn, 'req.user?.employeeId || req.user?.profileId', 'sale return profileId employee fallback');

const supplierPaymentRoutes = read('src/modules/procurement/supplier-payment/routes/supplierPaymentRoutes.js');
assertContains(supplierPaymentRoutes, 'requireSupplierPaymentActor', 'supplier payment actor route guard');

const schema = readPrismaSchemaSource(root);
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