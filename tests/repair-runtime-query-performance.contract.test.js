const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'repair',
  'query',
  'list-jobs',
  'listRepairJobsRepository.js'
);
const source = fs.readFileSync(repositoryPath, 'utf8');

test('repair queue uses a dedicated lightweight list include', () => {
  assert.match(source, /const repairJobListInclude =/);
  assert.match(source, /include: repairJobListInclude/);
  assert.match(source, /snapshot: true/);
  assert.match(source, /consent: true/);
  assert.match(source, /photos: true/);
});

test('repair queue does not load purchase and sales history graphs', () => {
  assert.doesNotMatch(source, /purchaseOrderReceiptItem/);
  assert.doesNotMatch(source, /saleItems/);
  assert.doesNotMatch(source, /performedBy: true/);
});

test('repair queue remains branch scoped and bounded', () => {
  assert.match(source, /branchId: Number\(branchId\)/);
  assert.match(source, /take: filters\.limit/);
  assert.match(source, /skip: filters\.offset/);
});
