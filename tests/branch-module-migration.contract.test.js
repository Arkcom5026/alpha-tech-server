'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

assert.equal(exists('routes/branchRoutes.js'), false, 'legacy branch route must be removed');
assert.equal(exists('controllers/branchController.js'), false, 'legacy branch controller must be removed');
assert.equal(exists('constants/branchFeaturePresets.js'), false, 'legacy branch presets must be removed');

assert.equal(exists('src/modules/branch/index.js'), true);
assert.equal(exists('src/modules/branch/routes/branchRoutes.js'), true);
assert.equal(exists('src/modules/branch/controllers/branchController.js'), true);
assert.equal(exists('src/modules/branch/constants/branchFeaturePresets.js'), true);

const server = read('server.js');
const moduleEntry = read('src/modules/branch/index.js');
const routes = read('src/modules/branch/routes/branchRoutes.js');
const controller = read('src/modules/branch/controllers/branchController.js');

assert.match(server, /require\('\.\/src\/modules\/branch'\)/);
assert.doesNotMatch(server, /require\('\.\/routes\/branchRoutes'\)/);
assert.match(server, /app\.use\('\/api\/branches', branchRoutes\)/);

assert.match(moduleEntry, /branchRoutes/);
assert.match(moduleEntry, /branchController/);
assert.match(moduleEntry, /branchFeaturePresets/);

assert.match(routes, /router\.get\('\/'/);
assert.match(routes, /router\.get\('\/:id'/);
assert.match(routes, /router\.post\('\/'/);
assert.match(routes, /router\.put\('\/:id'/);
assert.match(routes, /router\.delete\('\/:id'/);

assert.match(controller, /prisma\.branch\.findMany/);
assert.match(controller, /prisma\.branch\.findUnique/);
assert.match(controller, /prisma\.branch\.create/);
assert.match(controller, /prisma\.branch\.update/);
assert.match(controller, /prisma\.branch\.delete/);
assert.match(controller, /BASE_BRANCH_ID = 2/);

console.log('Branch module migration contract: PASS');
