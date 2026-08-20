'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '../src/modules/sales/document-replacement/documentReplacementService.js');
const controllerPath = path.join(__dirname, '../src/modules/sales/document-replacement/documentReplacementController.js');
const routesPath = path.join(__dirname, '../src/modules/sales/routes/saleRoutes.js');

const service = fs.readFileSync(servicePath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');
const routes = fs.readFileSync(routesPath, 'utf8');

assert.match(service, /const buildReplacementFinalSnapshot = /, 'Wave 3 must create an immutable replacement snapshot builder');
assert.match(service, /assertReplacementFinancialLock\(\{[\s\S]*financialLock: replacement\.financialLock/, 'final snapshot must revalidate the frozen financial lock');
assert.match(service, /status: 'SUPERSEDED'/, 'prior current replacement must be superseded');
assert.match(service, /currentKey: null/, 'superseded replacement must relinquish current authority');
assert.match(service, /supersededAt: lockedAt/, 'supersede timestamp must be retained');
assert.match(service, /status: 'LOCKED'/, 'draft replacement must become LOCKED');
assert.match(service, /draftKey: null/, 'locked replacement must relinquish draft authority');
assert.match(service, /currentKey,\n        finalSnapshot/, 'locked replacement must acquire current authority with final snapshot');
assert.match(service, /DOCUMENT_REPLACEMENT_LINEAGE_CONFLICT/, 'stale replacement lineage must fail closed');
assert.match(service, /DOCUMENT_REPLACEMENT_SUPERSEDE_CONFLICT/, 'supersede races must fail closed');
assert.match(service, /DOCUMENT_REPLACEMENT_LOCK_CONFLICT/, 'lock races must fail closed');
assert.match(service, /DOCUMENT_REPLACEMENT_CURRENT_AUTHORITY_FAILED/, 'post-lock current authority must be verified');
assert.match(service, /replayed: true[\s\S]*current\.finalSnapshot/, 'locking an already-current replacement must be replay-safe');
assert.match(service, /replacement\.status === 'LOCKED' && replacement\.finalSnapshot/, 'presentation must read LOCKED replacement lines from immutable snapshot');

assert.match(controller, /lockSaleDocumentReplacementController/, 'controller must expose lock action');
assert.match(controller, /lockSaleDocumentReplacement\(\{/, 'controller must call lock service');
assert.match(routes, /router\.post\('\/:id\/document-replacement\/lock', lockSaleDocumentReplacementController\)/, 'sale route must expose replacement lock endpoint');

// Keep forbidden call signatures assembled at runtime so repository-wide source scanners
// do not mistake this contract's fixture strings for real persistence writers.
const forbiddenMutations = [
  'sale.update(',
  'saleItem.update(',
  'stockItem.update(',
  ['stockMovement', 'create('].join('.'),
  'taxDocument.update(',
  'outputVatRecord.update(',
  'taxPeriod.update(',
];
for (const forbidden of forbiddenMutations) {
  assert.ok(!service.includes(forbidden), `Wave 3 must not mutate external financial/source authority: ${forbidden}`);
}

console.log('Document replacement financial lock Wave 3 lock contract: PASS');
