'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const projection = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');

assert.match(
  projection,
  /loadLegacySaleDeliveryNoteLifecycle/,
  'canonical Delivery Note print projection must consume the lifecycle compatibility authority',
);
assert.match(
  projection,
  /returnedQuantity:\s*true/g,
  'print source query must load returned quantity evidence for lifecycle projection',
);
assert.match(
  projection,
  /lifecycleState:\s*lifecycle\.lifecycleState/,
  'document projection must expose lifecycle state additively',
);
assert.match(
  projection,
  /grossAmount:\s*lifecycle\.grossAmount/,
  'document projection must expose historical gross amount',
);
assert.match(
  projection,
  /returnedAmount:\s*lifecycle\.returnedAmount/,
  'document projection must expose returned value',
);
assert.match(
  projection,
  /activeAmount:\s*lifecycle\.activeAmount/,
  'document projection must expose active remaining value',
);
assert.match(
  projection,
  /lifecycleActions:\s*lifecycle\.actions/,
  'document projection must expose current action authority',
);
assert.match(
  projection,
  /deliveryNoteLifecycle:\s*lifecycle/,
  'full lifecycle read model must be available to future client/history consumers',
);

// Wave 1B is deliberately additive: legacy print body remains historical evidence.
assert.match(
  projection,
  /totalAmount:\s*amount\(sale\.totalAmount\)/,
  'Wave 1B must preserve the historical Sale gross total in the existing print contract',
);
assert.match(
  projection,
  /const lines = currentReplacement\?\.lines\?\.length[\s\S]*?: sourceLines/,
  'Wave 1B must preserve the existing line rendering authority until revision persistence exists',
);
assert.match(
  projection,
  /DELIVERY_NOTE_ALREADY_CONSOLIDATED/,
  'legacy active-print guard must remain intact during additive lifecycle integration',
);
assert.doesNotMatch(
  projection,
  /stockMovement|stockItem\.update|payment\.create|sale\.update|taxDocument\.create/,
  'read integration must not introduce business mutations',
);

console.log('Delivery Note lifecycle Wave 1B print read integration contract: PASS');
