const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'src/modules/customer/routes/customerRoutes.js');
const controllerPath = path.join(
  root,
  'src/modules/customer/create/customerCreateController.js'
);
const servicePath = path.join(root, 'src/modules/customer/create/customerCreateService.js');
const repositoryPath = path.join(
  root,
  'src/modules/customer/create/customerCreateRepository.js'
);
const legacyPath = path.join(
  root,
  'src/modules/customer/controllers/customerCreateController.js'
);

assert.ok(fs.existsSync(routePath), 'customer routes must exist');
assert.ok(fs.existsSync(controllerPath), 'customer create controller slice must exist');
assert.ok(fs.existsSync(servicePath), 'customer create service slice must exist');
assert.ok(fs.existsSync(repositoryPath), 'customer create repository slice must exist');
assert.ok(!fs.existsSync(legacyPath), 'legacy customer create controller must be retired');

const routeSource = fs.readFileSync(routePath, 'utf8');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const repositorySource = fs.readFileSync(repositoryPath, 'utf8');

assert.match(
  routeSource,
  /require\('\.\.\/create\/customerCreateController'\)/,
  'route must import the customer create slice controller'
);
assert.match(
  routeSource,
  /router\.post\('\/'\s*,\s*customerCreateController\.createCustomer\)/,
  'POST / must be owned by the customer create slice'
);
assert.doesNotMatch(
  routeSource,
  /controllers\/customerCreateController/,
  'route must not reference the legacy create controller'
);
assert.match(
  controllerSource,
  /customerCreateService\.createCustomer/,
  'controller must delegate to service'
);
assert.doesNotMatch(controllerSource, /prisma\./, 'controller must not access Prisma');
assert.match(
  serviceSource,
  /customerCreateRepository|\.\/customerCreateRepository/,
  'service must depend on repository'
);
assert.doesNotMatch(serviceSource, /prisma\./, 'service must not access Prisma directly');
assert.match(repositorySource, /const \{ prisma \}/, 'repository must own Prisma access');
assert.match(
  repositorySource,
  /prisma\.\$transaction/,
  'repository must own the customer creation transaction boundary'
);

require(controllerPath);

console.log('customer-create-slice.contract: PASS');
