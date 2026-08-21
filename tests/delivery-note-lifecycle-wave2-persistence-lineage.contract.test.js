'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(
  path.join(root, 'prisma/commerce/delivery-note-lifecycle.prisma'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260821163500_delivery_note_lifecycle_wave2_persistence/migration.sql'),
  'utf8',
);
const design = fs.readFileSync(
  path.join(root, 'docs/workflows/delivery-note-lifecycle-wave2-persistence-design.md'),
  'utf8',
);

assert.match(schema, /model DeliveryNoteDocument/);
assert.match(schema, /model DeliveryNoteDocumentLine/);
assert.match(schema, /model DeliveryNoteDocumentReturnSource/);
assert.match(schema, /enum DeliveryNoteDocumentState[\s\S]*CURRENT[\s\S]*SUPERSEDED[\s\S]*CONSOLIDATED[\s\S]*CANCELLED/);
assert.match(schema, /enum DeliveryNoteRevisionKind[\s\S]*ORIGINAL[\s\S]*RETURN_ADJUSTMENT/);
assert.match(schema, /replacesDocumentId\s+Int\?\s+@unique/);
assert.match(schema, /currentKey\s+String\?\s+@unique/);
assert.match(schema, /@@unique\(\[branchId, saleId, revisionNumber\]\)/);
assert.match(schema, /@@unique\(\[deliveryNoteDocumentId, sourceLineType, sourceLineId\]\)/);
assert.match(schema, /@@unique\(\[deliveryNoteDocumentId, saleReturnId\]\)/);

assert.match(migration, /DeliveryNoteDocument_currentKey_check/);
assert.match(migration, /"state" = 'CURRENT' AND "currentKey" IS NOT NULL/);
assert.match(migration, /DeliveryNoteDocument_replacesDocumentId_fkey/);
assert.match(migration, /ON DELETE RESTRICT/);
assert.match(migration, /DeliveryNoteDocumentLine_deliveryNoteDocumentId_fkey/);
assert.match(migration, /ON DELETE CASCADE/);

assert.match(design, /legacy original can be materialized as revision 1/i);
assert.match(design, /return-adjusted document created as revision 2/i);
assert.match(design, /historical gross 1,810/i);
assert.match(design, /active 1,170/i);
assert.match(design, /SaleDocumentReplacement/);
assert.match(design, /must never create a Sale, StockMovement, payment, receivable, refund, or tax event/i);

console.log('Delivery Note lifecycle Wave 2 persistence lineage contract: PASS');
