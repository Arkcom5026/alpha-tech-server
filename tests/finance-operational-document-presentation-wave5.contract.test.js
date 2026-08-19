'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const capability = require('../src/modules/document-presentation/presentationCapabilityRegistry');
const serviceSource = read('src/modules/document-presentation/financeOperationalPresentationSnapshotService.js');

for (const code of ['CUSTOMER_MONEY_RECEIPT', 'DELIVERY_CREDIT_SETTLEMENT', 'REFUND_RECEIPT']) {
  const profile = capability.getDocumentPresentationCapability(code);
  assert(profile, `${code} must have a presentation capability profile`);
  assert.strictEqual(profile.className, 'FINANCE_OPERATIONAL');
  assert(profile.rendererFamilies.includes('A4'));
  assert(profile.rendererFamilies.includes('THERMAL_80MM'));
  assert(profile.protectedBlocks.includes('SYSTEM_NOTICE'));
  assert(!profile.storeBlocks.includes('SYSTEM_NOTICE'));
}

assert(serviceSource.includes('getOrCreatePresentationSnapshot'));
assert(serviceSource.includes("capability.className !== 'FINANCE_OPERATIONAL'"));
assert(serviceSource.includes('branch.documentHeaderConfig'));
assert(serviceSource.includes('for (const rendererFamily of rendererFamilies)'));
assert(serviceSource.includes('businessSnapshot'));

console.log('Finance Operational Document Presentation Wave 5 Contract: PASS');
