'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  projectWorkspaceReadLine,
  summarizeWorkspaceLines,
} = require('../src/modules/finance/combined-billing/documentWorkspaceReadProjection');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(
  path.join(root, 'src/modules/finance/combined-billing/documentWorkspaceService.js'),
  'utf8',
);

const sale = {
  id: 1046,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  soldAt: new Date('2026-08-19T00:00:00.000Z'),
};

const sandisk = projectWorkspaceReadLine({
  sale,
  type: 'STOCK',
  item: { id: 10, price: 1170, returnedQuantity: 0, documentDescription: 'SANDISK' },
  settledAmount: 1170,
});
assert.equal(sandisk.activeQuantity, 1);
assert.equal(sandisk.activeAmount, 1170);
assert.equal(sandisk.status, 'PAID_READY');
assert.equal(sandisk.selectableForConsolidation, true);

const apacer = projectWorkspaceReadLine({
  sale,
  type: 'SIMPLE',
  item: { id: 20, quantity: 2, price: 640, returnedQuantity: 2, documentDescription: 'APACER' },
  settledAmount: 0,
});
assert.equal(apacer.originalQuantity, 2);
assert.equal(apacer.returnedQuantity, 2);
assert.equal(apacer.activeQuantity, 0);
assert.equal(apacer.originalAmount, 640);
assert.equal(apacer.returnedAmount, 640);
assert.equal(apacer.activeAmount, 0);
assert.equal(apacer.status, 'RETURNED');
assert.equal(apacer.selectableForConsolidation, false);

const summary = summarizeWorkspaceLines([sandisk, apacer]);
assert.equal(summary.originalAmount, 1810);
assert.equal(summary.returnedAmount, 640);
assert.equal(summary.activeAmount, 1170);
assert.equal(summary.hasReturn, true);
assert.equal(summary.counts.RETURNED, 1);

const partial = projectWorkspaceReadLine({
  sale,
  type: 'SIMPLE',
  item: { id: 21, quantity: 4, price: 1000, returnedQuantity: 1 },
  settledAmount: 500,
});
assert.equal(partial.activeQuantity, 3);
assert.equal(partial.returnedAmount, 250);
assert.equal(partial.activeAmount, 750);
assert.equal(partial.status, 'PARTIALLY_PAID');
assert.equal(partial.selectableForConsolidation, false);

assert.match(service, /returnedQuantity:\s*true/,
  'Document Workspace list query must load returnedQuantity evidence');
assert.match(service, /projectWorkspaceReadLine/,
  'Document Workspace list must consume the return-aware read projector');
assert.match(service, /selectableForConsolidation/,
  'Document Workspace read model must expose selection authority');
assert.match(service, /returnedAmount/,
  'Document Workspace sale summary must expose returned amount');

console.log('Delivery Note lifecycle Wave 1E Document Workspace read authority contract: PASS');
