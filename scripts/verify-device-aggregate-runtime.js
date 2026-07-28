/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

let failed = false;
const pass = (label) => console.log(`PASS: ${label}`);
const fail = (label) => {
  failed = true;
  console.error(`FAIL: ${label}`);
};
const assertContains = (source, value, label) => {
  if (source.includes(value)) pass(label);
  else fail(`${label} is missing`);
};
const assertNotContains = (source, value, label) => {
  if (source.includes(value)) fail(`${label} is present`);
  else pass(label);
};

const syntaxFiles = [
  'scripts/ensure-device-intake-foundation.js',
  'src/modules/repair/routes/repairRoutes.js',
  'src/modules/repair/external-intake/createExternalDeviceIntakeController.js',
  'src/modules/repair/external-intake/createExternalDeviceIntakeService.js',
  'src/modules/repair/external-intake/externalDeviceIntakeRepository.js',
  'src/modules/repair/query/intake-search/intakeSearchController.js',
  'src/modules/repair/query/intake-search/intakeSearchService.js',
  'src/modules/repair/query/intake-search/intakeSearchRepository.js',
  'src/modules/repair/claim/open/openWarrantyClaimService.js',
  'src/modules/repair/claim/open/openWarrantyClaimRepository.js',
];

for (const relativePath of syntaxFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, relativePath)], {
      stdio: 'pipe',
    });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

const schema = read('prisma/schema.prisma');
assertContains(schema, 'model Device {', 'Device aggregate model');
assertContains(schema, 'model DevicePassportEvent {', 'Device passport event model');
assertContains(schema, 'model DeviceOwnershipHistory {', 'Device ownership history model');
assertContains(schema, 'model DeviceIntake {', 'Device intake aggregate model');
assertContains(schema, 'model DeviceIntakeAudit {', 'Device intake audit model');
assertContains(schema, '@@unique([branchId, barcode])', 'branch-scoped device barcode identity');
assertContains(schema, 'deviceId', 'repair and claim device identity field');

const packageJson = read('package.json');
assertContains(packageJson, '"prestart": "npm run db:ensure-device-intake"', 'device foundation prestart authority');
assertContains(packageJson, '"db:ensure-device-intake": "node scripts/ensure-device-intake-foundation.js"', 'device foundation command');

const foundation = read('scripts/ensure-device-intake-foundation.js');
assertContains(foundation, "require('dotenv').config();", 'device foundation environment loading');
assertContains(foundation, "process.env.DATABASE_URL || process.env.DIRECT_URL", 'device foundation runtime database preference');
assertContains(foundation, 'Device foundation connection authority', 'device foundation connection authority evidence');
assertContains(foundation, "['localhost', '127.0.0.1', '::1']", 'device foundation local SSL policy');

const repairRoutes = read('src/modules/repair/routes/repairRoutes.js');
assertContains(repairRoutes, "'/intakes/external-device'", 'external device intake endpoint');
assertContains(repairRoutes, "'/intake-search'", 'unified device intake search endpoint');
assertContains(repairRoutes, "'/jobs/:id/warranty-claims'", 'device-backed warranty claim endpoint');
assertNotContains(repairRoutes, "require('../../../controllers/repairController')", 'legacy repair controller route ownership');

const intakeService = read('src/modules/repair/external-intake/createExternalDeviceIntakeService.js');
assertContains(intakeService, 'barcode', 'external intake store barcode handling');
assertContains(intakeService, 'device', 'external intake device persistence');

const intakeSearchRepository = read('src/modules/repair/query/intake-search/intakeSearchRepository.js');
assertContains(intakeSearchRepository, 'device', 'intake search registered device projection');
assertContains(intakeSearchRepository, 'barcode', 'intake search barcode identity');

const claimRepository = read('src/modules/repair/claim/open/openWarrantyClaimRepository.js');
assertContains(claimRepository, 'device', 'warranty claim device context');

if (failed) {
  console.error('\nDEVICE AGGREGATE VERIFICATION: FAIL');
  process.exit(1);
}

console.log('\nDEVICE AGGREGATE VERIFICATION: PASS');
