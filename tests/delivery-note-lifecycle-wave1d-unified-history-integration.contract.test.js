'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(
  path.join(root, 'src/modules/finance/combined-billing/unifiedDocumentHistoryController.js'),
  'utf8',
);
const projector = fs.readFileSync(
  path.join(root, 'src/modules/sales/delivery-note/lifecycle/projectDeliveryNoteHistoryLifecycle.js'),
  'utf8',
);

assert.match(
  controller,
  /mergeDeliveryNoteLifecycleIntoHistoryRow/,
  'unified history must consume the shared Delivery Note lifecycle history projector',
);

assert.match(
  controller,
  /purpose === 'DELIVERY_NOTE'\s*\?\s*\{\}\s*:\s*consumedSourceExclusion/,
  'Delivery Note history must retain consumed source Sales for historical visibility',
);

assert.match(
  controller,
  /select:\s*\{\s*sourceSaleId:\s*true,\s*combinedBillingId:\s*true\s*\}/,
  'active consolidation discovery must retain the destination document id',
);

assert.match(
  controller,
  /activeConsolidationBySaleId\.get\(sale\.id\)/,
  'Sale rows must receive active consolidation evidence for lifecycle projection',
);

assert.match(
  controller,
  /sourceType:\s*'DOCUMENT_PREPARATION'/,
  'Delivery Note history must detect issued tax authority that moved through document preparation',
);
assert.match(
  controller,
  /preparedTaxBySaleId/,
  'prepared tax authority must be mapped back to the source Sale lifecycle row',
);

assert.match(
  projector,
  /lifecycleHistoricalReadable/,
  'shared history projector must expose historical readability semantics',
);
assert.match(
  projector,
  /lifecycleCurrentAuthority/,
  'shared history projector must expose current action authority separately from history',
);

console.log('Delivery Note lifecycle Wave 1D unified history integration contract: PASS');
