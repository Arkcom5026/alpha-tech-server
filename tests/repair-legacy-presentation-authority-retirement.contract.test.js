const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

test('cross-module repair projections expose canonical repairAsset instead of legacy presentation fields', () => {
  const expenseReasons = read('src', 'modules', 'tax-expense', 'query', 'repair-reasons', 'listRepairExpenseReasonsSlice.js');
  const productTrace = read('src', 'modules', 'product', 'trace', 'builders', 'productTraceRepairBuilder.js');

  assert.match(expenseReasons, /repairAsset: mapRepairAsset\(row\.repairJob\)/);
  assert.match(productTrace, /repairAsset: mapRepairAsset\(\{ \.\.\.repair, stockItem \}\)/);
  assert.doesNotMatch(productTrace, /deviceModel: repair\.deviceModel/);
});

test('legacy fields remain confined to canonical mapper and write compatibility paths', () => {
  const mapper = read('src', 'modules', 'repair', 'mappers', 'repairMapper.js');
  assert.match(mapper, /nonEmpty\(job\.deviceModel\)/);
  assert.match(mapper, /nonEmpty\(intake\?\.assetDescription\)/);
});
