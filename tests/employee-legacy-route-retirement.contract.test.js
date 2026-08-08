const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const canonicalRoutePath = path.join(
  root,
  'src/modules/employee/routes/employeeRoutes.js'
);
const legacyRoutePath = path.join(
  root,
  'routes/purchaseOrderReceiptSimpleRoutes.js'
);

const serverSource = require('../scripts/read-server-composition-source').readServerCompositionSource(root);

assert(
  serverSource.includes("require('./src/modules/employee/routes/employeeRoutes')"),
  'server must mount the canonical employee module route'
);
assert(
  serverSource.includes("app.use('/api/employees', employeeRoutes)"),
  'canonical employee endpoint must remain mounted'
);
assert(
  !serverSource.includes('purchaseOrderReceiptSimpleRoutes'),
  'server must not import or mount the mislabeled legacy employee route'
);
assert(fs.existsSync(canonicalRoutePath), 'canonical employee route must exist');
assert(!fs.existsSync(legacyRoutePath), 'mislabeled legacy employee route must be retired');

const employeeRoutes = require(canonicalRoutePath);
assert(employeeRoutes, 'canonical employee route graph must resolve');

console.log('employee-legacy-route-retirement.contract: PASS');
