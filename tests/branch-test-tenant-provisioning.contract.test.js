const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '..', 'controllers', 'branchController.js');
const source = fs.readFileSync(controllerPath, 'utf8');

const testModeStart = source.indexOf("const TEST_BRANCH_SLUG_PREFIX = 'system-test-';");
const testModeReturn = source.indexOf('return res.status(201).json({ ...created, clonedPrices: 0, testMode: true });');
const priceClone = source.indexOf('await prisma.branchPrice.findMany');

assert.ok(testModeStart >= 0, 'test tenant mode must be explicitly declared');
assert.ok(
  source.includes('testMode: body.testMode === true'),
  'testMode must be accepted only as an explicit boolean request',
);
assert.ok(
  source.includes("n.slug?.startsWith(TEST_BRANCH_SLUG_PREFIX)"),
  'test tenant mode must require a system-test slug marker',
);
assert.ok(testModeReturn >= 0, 'test tenant mode must return before price cloning');
assert.ok(
  testModeReturn < priceClone,
  'test tenant mode must never copy BranchPrice from the legacy base branch',
);
assert.ok(
  source.includes('const BASE_BRANCH_ID = 2;'),
  'existing non-test branch provisioning behavior must remain unchanged',
);

console.log('branch test tenant provisioning contract: PASS');
