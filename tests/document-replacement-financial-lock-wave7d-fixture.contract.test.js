'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'scripts/provision-document-replacement-e2e-fixture.js'),
  'utf8',
);

assert.match(script, /\.env\.restore/);
assert.match(script, /RESTORE_DATABASE_URL/);
assert.match(script, /assertTestDatabaseAuthority/);
assert.match(script, /requiresWriteApproval:\s*true/);
assert.match(script, /DOCUMENT_REPLACEMENT_E2E_FIXTURE_APPROVAL/);
assert.match(script, /ALPHATECH_DOCUMENT_REPLACEMENT_E2E_FIXTURE/);
assert.match(script, /ALPHATECH_RUNTIME_ENV\s*=\s*'TEST'/);
assert.match(script, /DOC-REPL-E2E:/);
assert.match(script, /SaleDocumentPreparation|saleDocumentPreparation/);
assert.match(script, /DOCUMENT_PREPARATION/);
assert.match(script, /IN_BUDGET/);
assert.match(script, /OUT_OF_BUDGET/);
assert.match(script, /taxInvoiceKind:\s*kind/);
assert.match(script, /ledgerType:\s*'OUTPUT_VAT'/);
assert.match(script, /taxPeriodId/);
assert.match(script, /retainedTestData:\s*true/);
assert.match(script, /sourceTotal:\s*5000/);
assert.match(script, /sourceTaxAmount:\s*327\.10/);
assert.match(script, /totalAmount:\s*4000/);
assert.match(script, /totalAmount:\s*1000/);
assert.doesNotMatch(script, /process\.env\.DATABASE_URL\s*=\s*process\.env\.DATABASE_URL/);

console.log('Document replacement financial lock Wave 7D fixture contract: PASS');
