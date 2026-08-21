'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260821163500_delivery_note_lifecycle_wave2_persistence/migration.sql');
const schema = read('prisma/commerce/delivery-note-lifecycle.prisma');
const service = read('src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js');
const verifier = read('scripts/verify-delivery-note-lifecycle-wave2g-db.js');

assert.match(schema, /model DeliveryNoteDocument/);
assert.match(schema, /model DeliveryNoteDocumentLine/);
assert.match(schema, /model DeliveryNoteDocumentReturnSource/);
assert.match(migration, /CREATE TABLE "DeliveryNoteDocument"/);
assert.match(migration, /DeliveryNoteDocument_currentKey_check/);
assert.match(migration, /DeliveryNoteDocument_replacesDocumentId_fkey/);
assert.match(service, /Prisma\.TransactionIsolationLevel\.Serializable/);
assert.match(service, /deriveDeliveryNoteRevisionNumber/);

assert.match(verifier, /DELIVERY_NOTE_LIFECYCLE_TEST_DATABASE_URL/);
assert.match(verifier, /YES_I_AM_USING_A_DISPOSABLE_DATABASE/);
assert.match(verifier, /Refusing to use DATABASE_URL/);
assert.match(verifier, /to_regclass\('\"DeliveryNoteDocument\"'\)/);
assert.match(verifier, /'SUPERSEDED'::"DeliveryNoteDocumentState"/);
assert.match(verifier, /'RETURN_ADJUSTMENT'::"DeliveryNoteRevisionKind"/);
assert.match(verifier, /DeliveryNoteDocumentLine/);
assert.match(verifier, /DeliveryNoteDocumentReturnSource/);
assert.match(verifier, /ROLLBACK_SENTINEL/);
assert.match(verifier, /rollback verification failed/);
assert.match(verifier, /transaction verification: PASS/);

console.log('Delivery Note lifecycle Wave 2G migration/transactional readiness contract: PASS');
