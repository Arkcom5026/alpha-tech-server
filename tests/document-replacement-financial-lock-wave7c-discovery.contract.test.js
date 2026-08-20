'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'scripts/discover-document-replacement-e2e-candidates.js'),
  'utf8',
);

assert.match(script, /\.env\.restore/);
assert.match(script, /RESTORE_DATABASE_URL/);
assert.match(script, /assertTestDatabaseAuthority/);
assert.match(script, /BEGIN READ ONLY/);
assert.match(script, /databaseModified:\s*false/);
assert.match(script, /SaleDocumentPreparation/);
assert.match(script, /DOCUMENT_PREPARATION/);
assert.match(script, /OutputVatRecord/);
assert.match(script, /SaleDocumentReplacement/);
assert.match(script, /deliveryNoteActive/);
assert.match(script, /recommended/);
assert.match(script, /JOIN\s+"CombinedBillingDocument"\s+cb/i);
assert.doesNotMatch(script, /JOIN\s+"CombinedBilling"\s+cb/i);

const queryCalls = [...script.matchAll(/client\.query\((['"`])([\s\S]*?)\1/g)].map((match) => match[2]);
for (const sql of queryCalls) {
  assert.doesNotMatch(sql, /^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
}

console.log('Document replacement financial lock Wave 7C discovery contract: PASS');
