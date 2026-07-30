const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '..', 'src', 'modules', 'branch', 'routes', 'branchRoutes.js');
const source = fs.readFileSync(routePath, 'utf8');

assert.ok(
  source.includes("const verifyToken = require('../../../../middlewares/verifyToken');"),
  'branch writes must use the canonical token verification middleware',
);
assert.ok(
  source.includes("const requireAdmin = require('../../../../middlewares/requireAdmin');"),
  'branch writes must use the canonical admin authorization middleware',
);

for (const method of ['post', 'put', 'delete']) {
  const pattern = new RegExp(`router\\.${method}\\([^\\n]*verifyToken, requireAdmin`);
  assert.ok(pattern.test(source), `${method.toUpperCase()} branch route must require token and admin role`);
}

assert.ok(
  source.includes("router.get('/', getAllBranches);"),
  'existing branch listing read route must remain available',
);
assert.ok(
  source.includes("router.get('/:id', getBranchById);"),
  'existing branch detail read route must remain available',
);

console.log('branch write authorization contract: PASS');
