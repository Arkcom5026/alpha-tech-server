const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const routeSource = fs.readFileSync(
  path.join(__dirname, '../../routes/saleRoutes.js'),
  'utf8',
);

const documentCapabilities = [
  POSITION_CAPABILITIES.SALES_DOCUMENT_PREPARE,
  POSITION_CAPABILITIES.SALES_DOCUMENT_LOCK,
  POSITION_CAPABILITIES.SALES_DOCUMENT_REPLACE,
  POSITION_CAPABILITIES.SALES_DOCUMENT_TAX_PUBLISH,
];

test('legacy employee roles preserve authenticated-only sales document behavior while positions migrate', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capabilities = legacyCapabilitiesForRole(role);
    for (const capability of documentCapabilities) {
      assert.ok(capabilities.includes(capability), `${role}:${capability}`);
    }
  }
});

test('migrated positions require explicit document capabilities', () => {
  const empty = { positionCapabilities: [] };
  for (const capability of documentCapabilities) {
    assert.equal(hasCapability(empty, capability), false, capability);
    assert.equal(hasCapability({ positionCapabilities: [capability] }, capability), true, capability);
  }
});

test('platform admin keeps sales document governance authority', () => {
  for (const actor of [
    { role: 'ADMIN', positionCapabilities: [] },
    { role: 'SUPERADMIN', positionCapabilities: [] },
  ]) {
    for (const capability of documentCapabilities) {
      assert.equal(hasCapability(actor, capability), true, capability);
    }
  }
});

test('sales document routes separate preparation, lock, replacement, and tax publication without gating delivery note', () => {
  assert.match(routeSource, /router\.post\('\/:id\/document-preparation', allowDocumentPreparation, createSaleDocumentPreparationController\)/);
  assert.match(routeSource, /router\.get\('\/:id\/document-preparation', allowDocumentPreparation, getSaleDocumentPreparationController\)/);
  assert.match(routeSource, /router\.put\('\/:id\/document-preparation\/lines', allowDocumentPreparation, replaceSaleDocumentPreparationLinesController\)/);
  assert.match(routeSource, /router\.post\('\/:id\/document-preparation\/lock', allowDocumentPreparationLock, lockSaleDocumentPreparationController\)/);
  assert.match(routeSource, /router\.post\('\/:id\/document-preparation\/tax-candidates', allowDocumentTaxPublish, registerSaleDocumentPreparationTaxCandidatesController\)/);
  assert.match(routeSource, /router\.post\('\/:id\/document-replacement', allowDocumentReplacement, createSaleDocumentReplacementController\)/);
  assert.match(routeSource, /router\.get\('\/:id\/document-replacement', allowDocumentReplacement, getSaleDocumentReplacementController\)/);
  assert.match(routeSource, /router\.put\('\/:id\/document-replacement\/lines', allowDocumentReplacement, replaceSaleDocumentReplacementLinesController\)/);
  assert.match(routeSource, /router\.post\('\/:id\/document-replacement\/lock', allowDocumentReplacementLock, lockSaleDocumentReplacementController\)/);
  assert.match(routeSource, /router\.put\('\/:id\/document-lines', allowDocumentPreparation, updateSaleDocumentLinesController\)/);
  assert.match(routeSource, /router\.put\('\/:id\/document-descriptions', allowDocumentPreparation, updateSaleDocumentLinesController\)/);

  assert.match(routeSource, /router\.post\('\/:id\/delivery-note', issueSaleDeliveryNoteController\)/);
  assert.match(routeSource, /router\.get\('\/:id\/delivery-note', getSaleDeliveryNote\)/);
  assert.doesNotMatch(routeSource, /delivery-note', allowDocument/);
});
