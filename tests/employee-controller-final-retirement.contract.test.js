const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const legacyControllerPath = path.join(root, 'controllers/employeeController.js');
const serverPath = path.join(root, 'server.js');
const moduleRoutePath = path.join(root, 'src/modules/employee/routes/employeeRoutes.js');
const verificationPath = path.join(root, 'scripts/verify-employee-lifecycle-runtime.js');

assert(!fs.existsSync(legacyControllerPath), 'legacy employee controller must be removed');
assert(fs.existsSync(serverPath), 'server runtime authority must remain');
assert(fs.existsSync(moduleRoutePath), 'employee module route must remain');

const serverSource = fs.readFileSync(serverPath, 'utf8');
const moduleRouteSource = fs.readFileSync(moduleRoutePath, 'utf8');
const verificationSource = fs.readFileSync(verificationPath, 'utf8');

assert(
  serverSource.includes("require('./src/modules/employee/routes/employeeRoutes')"),
  'server must import canonical employee module route directly'
);
assert(
  serverSource.includes("app.use('/api/employees', employeeRoutes)"),
  'server must preserve canonical employee endpoint mount'
);
assert(
  !serverSource.includes('controllers/employeeController'),
  'server must not reference legacy employee controller'
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
