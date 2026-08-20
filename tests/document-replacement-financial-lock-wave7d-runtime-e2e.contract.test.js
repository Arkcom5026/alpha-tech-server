'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts/run-document-replacement-wave7d-e2e.js'), 'utf8');

assert.match(script, /\.env\.restore/);
assert.match(script, /assertTestDatabaseAuthority/);
assert.match(script, /requiresWriteApproval:\s*true/);
assert.match(script, /DOCUMENT_REPLACEMENT_E2E_RUNTIME_APPROVAL/);
assert.match(script, /ALPHATECH_DOCUMENT_REPLACEMENT_E2E_RUNTIME/);
assert.match(script, /DOC-REPL-E2E:/);
assert.match(script, /createSaleDocumentReplacement/);
assert.match(script, /replaceSaleDocumentReplacementLines/);
assert.match(script, /lockSaleDocumentReplacement/);
assert.match(script, /loadCurrentReplacementPrintProjection/);
assert.match(script, /loadDocumentPreparationReplacementTaxProjection/);
assert.match(script, /create replay failed/);
assert.match(script, /lock replay failed/);
assert.match(script, /SUPERSEDED/);
assert.match(script, /replacesReplacementId/);
assert.match(script, /saleUnchanged:\s*true/);
assert.match(script, /preparationSnapshotUnchanged:\s*true/);
assert.match(script, /taxDocumentsUnchanged:\s*true/);
assert.match(script, /outputVatUnchanged:\s*true/);
assert.match(script, /taxPeriodUnchanged:\s*true/);
assert.match(script, /retainedTestData:\s*true/);
assert.doesNotMatch(script, /prisma\.(sale|taxDocument|outputVatRecord|taxPeriod)\.(update|updateMany|delete|deleteMany|create|createMany)/);

console.log('Document replacement financial lock Wave 7D runtime E2E contract: PASS');
