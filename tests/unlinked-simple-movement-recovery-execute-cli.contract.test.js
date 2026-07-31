const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cliPath = path.join(
  __dirname,
  '..',
  'scripts',
  'inventory-recovery',
  'execute-unlinked-simple-movement-recovery.js'
);
const source = fs.readFileSync(cliPath, 'utf8');

assert.ok(source.includes('validateUnlinkedSimpleMovementRecoveryApprovalDryRun'));
assert.ok(source.includes('buildUnlinkedSimpleMovementRecoveryExecutionPlan'));
assert.ok(source.includes('UnlinkedSimpleMovementRecoveryExecutionRepository'));
assert.ok(source.includes('executionPlan,'));
assert.ok(source.includes('repository,'));
assert.ok(source.includes('explicitApproval: true'));
assert.ok(source.includes("--approve=EXECUTE_SAFE_TO_LINK"));
assert.ok(!source.includes('approved,'));
assert.ok(!source.includes('executeUnlinkedSimpleMovementRecovery({\n    prisma,'));

console.log('unlinked simple movement recovery execute CLI contract: PASS');
