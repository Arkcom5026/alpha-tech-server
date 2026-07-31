const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const legacyControllerPath = path.join(root, 'controllers/employeeController.js');
const rootRoutePath = path.join(root, 'routes/employeeRoutes.js');
const moduleRoutePath = path.join(root, 'src/modules/employee/routes/employeeRoutes.js');
const verificationPath = path.join(root, 'scripts/verify-employee-lifecycle-runtime.js');

assert(!fs.existsSync(legacyControllerPath), 'legacy employee controller must be removed');
assert(fs.existsSync(rootRoutePath), 'employee root route wrapper must remain');
assert(fs.existsSync(moduleRoutePath), 'employee module route must remain');

const rootRouteSource = fs.readFileSync(rootRoutePath, 'utf8');
const moduleRouteSource = fs.readFileSync(moduleRoutePath, 'utf8');
const verificationSource = fs.readFileSync(verificationPath, 'utf8');

assert(
  rootRouteSource.includes('src/modules/employee/routes/employeeRoutes'),
  'root employee route must delegate to module authority'
);
assert(
  !rootRouteSource.includes('controllers/employeeController'),
  'root employee route must not reference legacy controller'
);
assert(
  !moduleRouteSource.includes('controllers/employeeController'),
  'module route must not reference legacy controller'
);
assert(
  verificationSource.includes("assertMissing('controllers/employeeController.js'"),
  'employee lifecycle verification must enforce controller retirement'
);

const employeeRoutes = require(moduleRoutePath);
assert(employeeRoutes, 'canonical employee module route graph must resolve');

console.log('employee-controller-final-retirement.contract: PASS');
