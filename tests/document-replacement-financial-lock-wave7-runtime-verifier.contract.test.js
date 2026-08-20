'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts/verify-document-replacement-runtime.js'), 'utf8');

assert.match(script, /\.env\.restore/);
assert.match(script, /RESTORE_DATABASE_URL/);
assert.match(script, /assertTestDatabaseAuthority/);
assert.match(script, /BEGIN READ ONLY/);
assert.match(script, /databaseModified:\s*false/);
assert.match(script, /SaleDocumentPreparation/);
assert.match(script, /SaleDocumentReplacement/);
assert.match(script, /TaxDocument/);
assert.match(script, /OutputVatRecord/);
assert.match(script, /tax period drift/);
assert.match(script, /SUPERSEDED/);
assert.match(script, /exactly one current LOCKED replacement/);
assert.doesNotMatch(script, /\bINSERT\b/i);
assert.doesNotMatch(script, /\bUPDATE\b/i);
assert.doesNotMatch(script, /\bDELETE\b/i);

console.log('Document replacement financial lock Wave 7 runtime verifier contract: PASS');
