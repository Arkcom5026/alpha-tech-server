'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = read('prisma/platform/document-presentation-snapshot.prisma');
const migration = read('prisma/migrations/20260819145500_document_presentation_snapshot_ledger/migration.sql');
const snapshotService = read('src/modules/document-presentation/persistentPresentationSnapshotService.js');
const projection = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const routes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(schema, /model DocumentPresentationSnapshot/);
assert.match(schema, /@@unique\(\[branchId, sourceType, sourceId, documentPurpose, rendererFamily\]\)/);
assert.match(schema, /snapshot\s+Json/);
assert.match(schema, /snapshotHash\s+String/);
assert.match(migration, /CREATE TABLE "DocumentPresentationSnapshot"/);
assert.doesNotMatch(migration, /DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM/i, 'Wave 2 snapshot migration must remain additive');
assert.doesNotMatch(migration, /^\s*UPDATE\s+/im, 'Wave 2 snapshot migration must not rewrite existing rows');

assert.match(snapshotService, /getOrCreatePresentationSnapshot/);
assert.match(snapshotService, /resolveDocumentPresentation/);
assert.match(snapshotService, /createPresentationSnapshotEnvelope/);
assert.match(snapshotService, /documentPresentationSnapshot\.findUnique/);
assert.match(snapshotService, /documentPresentationSnapshot\.upsert/);
assert.match(snapshotService, /update:\s*\{\}/, 'existing snapshots must not be mutated during idempotent upsert');

assert.match(routes, /router\.get\('\/:id\/delivery-note', getSaleDeliveryNote\)/);
assert.match(projection, /documentHeaderConfig:\s*true/);
assert.match(projection, /getOrCreatePresentationSnapshot/);
assert.match(projection, /sourceType:\s*'SALE'/);
assert.match(projection, /documentPurpose:\s*purpose\.code/);
assert.match(projection, /rendererFamily:\s*'A4'/);
assert.match(projection, /issuedAt:\s*sale\.soldAt/);
assert.match(projection, /presentationSnapshot:\s*presentationRecord\.snapshot/);
assert.match(projection, /officialDocumentNumber/);
assert.match(projection, /DELIVERY_NOTE_NOT_REQUIRED/);

console.log('delivery-note-document-presentation-wave2.contract.test.js: PASS');
