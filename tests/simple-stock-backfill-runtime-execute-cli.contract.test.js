const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cliPath = path.resolve(
  __dirname,
  '../scripts/inventory-recovery/execute-simple-stock-backfill.js'
);
const source = fs.readFileSync(cliPath, 'utf8');

assert.ok(source.includes("approval !== 'EXECUTE'"));
assert.ok(source.includes("requireText('manifest-id')"));
assert.ok(source.includes("requireText('snapshot-hash')"));
assert.ok(source.includes("requireText('execution-plan-id')"));
assert.ok(source.includes("requireText('execution-plan-hash')"));
assert.ok(source.includes("requireText('operator')"));
assert.ok(source.includes('validateSimpleStockBackfillApprovalDryRun'));
assert.ok(source.includes('buildSimpleStockBackfillExecutionPlan'));
assert.ok(source.includes('executeSimpleStockBackfill'));
assert.ok(source.includes('where: { branchId }'));
assert.ok(!source.includes('simpleLotId: { not: null }'));
assert.ok(source.includes('Runtime snapshot is stale; execution aborted'));
assert.ok(source.includes('explicitApproval: true'));
assert.ok(source.includes("result: 'SIMPLE_STOCK_BACKFILL_EXECUTED'"));

console.log('simple stock backfill runtime execute CLI contract: PASS');
