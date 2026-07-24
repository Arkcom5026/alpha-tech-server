/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const syntaxFiles = [
  'middlewares/verifyToken.js',
  'controllers/employeeController.js',
  'controllers/combinedBillingController.js',
  'controllers/branchPriceController.js',
  'routes/supplierPaymentRoutes.js',
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

for (const relativePath of syntaxFiles) {
  const absolutePath = path.join(root, relativePath);
  try {
    execFileSync(process.execPath, ['--check', absolutePath], { stdio: 'pipe' });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

const verifyToken = read('middlewares/verifyToken.js');
assertContains(verifyToken, "'USER_DISABLED'", 'verifyToken USER_DISABLED guard');
assertContains(verifyToken, "'EMPLOYEE_PROFILE_REQUIRED'", 'verifyToken employee profile guard');
assertContains(verifyToken, "'EMPLOYEE_NOT_APPROVED'", 'verifyToken approval guard');
assertContains(verifyToken, "'EMPLOYEE_INACTIVE'", 'verifyToken active guard');
assertContains(verifyToken, 'employeeId,', 'verifyToken canonical employeeId projection');
assertContains(verifyToken, 'branchId: employeeProfile?.branchId || null', 'verifyToken DB branch projection');

const combinedBilling = read('controllers/combinedBillingController.js');
assertNotContains(
  combinedBilling,
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

const supplierPaymentRoutes = read('routes/supplierPaymentRoutes.js');
assertContains(
  supplierPaymentRoutes,
  'requireSupplierPaymentActor',
  'supplier payment actor route guard'
);

const schema = read('prisma/schema.prisma');
const employeeProfileBlock = schema.match(/model\s+EmployeeProfile\s*\{[\s\S]*?\n\}/)?.[0] || '';
assertContains(employeeProfileBlock, 'onDelete: Restrict', 'EmployeeProfile.user onDelete Restrict');
assertContains(employeeProfileBlock, 'active', 'EmployeeProfile active lifecycle field');
assertContains(employeeProfileBlock, 'approved', 'EmployeeProfile approved lifecycle field');

if (process.exitCode) {
  console.error('\nEMPLOYEE LIFECYCLE VERIFICATION: FAIL');
  process.exit(process.exitCode);
}

console.log('\nEMPLOYEE LIFECYCLE VERIFICATION: PASS');
