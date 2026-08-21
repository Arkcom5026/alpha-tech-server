'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runner = fs.readFileSync(
  path.join(root, 'scripts/verify-delivery-note-lifecycle-wave2h-certification.js'),
  'utf8',
);

for (const requiredTest of [
  'delivery-note-lifecycle-wave1b-print-read-integration.contract.test.js',
  'delivery-note-lifecycle-wave1c-history-projection.contract.test.js',
  'delivery-note-lifecycle-wave1d-unified-history-integration.contract.test.js',
  'delivery-note-lifecycle-wave1e-document-workspace-read-authority.contract.test.js',
  'delivery-note-lifecycle-wave1f-document-workspace-write-guard.contract.test.js',
  'delivery-note-lifecycle-wave2-persistence-lineage.contract.test.js',
  'delivery-note-lifecycle-wave2b-materialization-revision-authority.contract.test.js',
  'delivery-note-lifecycle-wave2c-current-read-print-resolution.contract.test.js',
  'delivery-note-lifecycle-wave2d-historical-lineage-read.contract.test.js',
  'delivery-note-lifecycle-wave2e-historical-revision-print.contract.test.js',
  'delivery-note-lifecycle-wave2f-revision-http-numbering.contract.test.js',
  'delivery-note-lifecycle-wave2g-migration-transactional-readiness.contract.test.js',
  'delivery-note-history-print-eligibility.contract.test.js',
  'sale-delivery-note-print-projection.contract.test.js',
]) {
  assert.match(runner, new RegExp(requiredTest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(runner, /--production-schema/);
assert.match(runner, /verify-delivery-note-lifecycle-wave2g-production-schema\.js/);
assert.doesNotMatch(runner, /migrate\s+deploy|prisma\s+db\s+push|INSERT INTO|UPDATE\s+"|DELETE FROM/i);
assert.match(runner, /Delivery Note lifecycle Wave 2H integration certification: PASS/);

console.log('Delivery Note lifecycle Wave 2H integration certification contract: PASS');
