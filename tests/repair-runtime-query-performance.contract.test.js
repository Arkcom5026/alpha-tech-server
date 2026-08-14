const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const listRepositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'repair',
  'query',
  'list-jobs',
  'listRepairJobsRepository.js'
);
const detailRepositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'repair',
  'query',
  'job-detail',
  'repairJobDetailRepository.js'
);
const listSource = fs.readFileSync(listRepositoryPath, 'utf8');
const detailSource = fs.readFileSync(detailRepositoryPath, 'utf8');

test('repair queue uses a dedicated lightweight list include', () => {
  assert.match(listSource, /const repairJobListInclude =/);
  assert.match(listSource, /include: repairJobListInclude/);
  assert.match(listSource, /snapshot: true/);
  assert.match(listSource, /consent: \{ select: \{ id: true \} \}/);
  assert.match(listSource, /photos: \{[\s\S]*select: \{ category: true \}/);
});

test('repair queue does not load purchase, sales, parts, or warranty claim graphs', () => {
  assert.doesNotMatch(listSource, /purchaseOrderReceiptItem/);
  assert.doesNotMatch(listSource, /saleItems/);
  assert.doesNotMatch(listSource, /partsUsed:/);
  assert.doesNotMatch(listSource, /warrantyClaims:/);
  assert.doesNotMatch(listSource, /performedBy: true/);
});

test('repair detail keeps canonical intake snapshot without loading unrelated history graphs', () => {
  assert.match(detailSource, /snapshot: true/);
  assert.doesNotMatch(detailSource, /purchaseOrderReceiptItem/);
  assert.doesNotMatch(detailSource, /saleItems/);
  assert.doesNotMatch(detailSource, /performedBy: true/);
});

test('repair detail starts branch-safe reads concurrently and avoids duplicate repair workflow latest query', () => {
  assert.match(detailSource, /const jobPromise =/);
  assert.match(detailSource, /const repairOwnedHistoryPromise =/);
  assert.match(detailSource, /await Promise\.all\(\[/);
  assert.doesNotMatch(detailSource, /findLatestRepairWorkflowEvent/);
  assert.match(detailSource, /const repairOwnedLatest = repairOwnedHistory\[0\] \|\| null/);
  assert.match(detailSource, /if \(!repairOwnedHistory\.length && job\.deviceId\)/);
});

test('repair queue and detail remain branch scoped and queue stays bounded', () => {
  assert.match(listSource, /branchId: Number\(branchId\)/);
  assert.match(listSource, /take: filters\.limit/);
  assert.match(listSource, /skip: filters\.offset/);
  assert.match(detailSource, /branchId: branch/);
});
