'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildIntegrity,
} = require('../src/modules/tax/finalization/taxClosingFinalizationIntegrity');
const {
  requireExpectedSnapshotHash,
} = require('../src/modules/tax/finalization/taxClosingFinalizationService');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('finalization integrity distinguishes not-finalized current and stale snapshots', () => {
  assert.equal(buildIntegrity({ currentSnapshotHash: 'a', finalization: null }).status, 'NOT_FINALIZED');
  const current = buildIntegrity({ currentSnapshotHash: 'a', finalization: { snapshotHash: 'a', version: 2 } });
  assert.equal(current.status, 'CURRENT');
  assert.equal(current.requiresRefinalization, false);
  const stale = buildIntegrity({ currentSnapshotHash: 'b', finalization: { snapshotHash: 'a', version: 2 } });
  assert.equal(stale.status, 'STALE');
  assert.equal(stale.requiresRefinalization, true);
});

test('finalization authority is append-only versioned snapshot evidence', () => {
  const schema = read('prisma/tax/tax-closing-finalization.prisma');
  const migration = read('prisma/migrations/20260811110000_tax_closing_finalization/migration.sql');
  const repository = read('src/modules/tax/finalization/taxClosingFinalizationRepository.js');
  assert.match(schema, /model TaxClosingFinalization/);
  assert.match(schema, /snapshotHash/);
  assert.match(schema, /snapshot\s+Json/);
  assert.match(schema, /manifest\s+Json/);
  assert.match(schema, /@@unique\(\[branchId, taxPeriodId, version\]/);
  assert.match(migration, /CREATE TABLE "TaxClosingFinalization"/);
  assert.match(migration, /JSONB NOT NULL/);
  assert.doesNotMatch(migration, /INSERT INTO "TaxClosingFinalization"[^\s\S]*SELECT/i);
  assert.match(repository, /ORDER BY "version" DESC/);
  assert.match(repository, /INSERT INTO "TaxClosingFinalization"/);
  assert.doesNotMatch(repository, /UPDATE "TaxClosingFinalization"/);
  assert.doesNotMatch(repository, /DELETE FROM "TaxClosingFinalization"/);
});

test('finalization only records the exact ready snapshot reviewed by the user and supports replay', () => {
  const service = read('src/modules/tax/finalization/taxClosingFinalizationService.js');
  const controller = read('src/modules/tax/handoff/taxClosingHandoffController.js');
  assert.match(service, /requireExpectedSnapshotHash/);
  assert.match(service, /bundle\.handoffReady/);
  assert.match(service, /TAX_CLOSING_FINALIZATION_NOT_READY/);
  assert.match(service, /bundle\.snapshotHash !== reviewedSnapshotHash/);
  assert.match(service, /TAX_CLOSING_FINALIZATION_SNAPSHOT_CHANGED/);
  assert.match(service, /expectedSnapshotHash: reviewedSnapshotHash/);
  assert.match(service, /currentSnapshotHash: bundle\.snapshotHash/);
  assert.match(service, /latest\?\.snapshotHash === bundle\.snapshotHash/);
  assert.match(service, /replayed: true/);
  assert.match(service, /isolationLevel: 'Serializable'/);
  assert.match(service, /TAX_CLOSING_FINALIZATION_CONFLICT/);
  assert.match(controller, /expectedSnapshotHash: req\.body\?\.expectedSnapshotHash/);
});

test('expected reviewed snapshot hash is a mandatory SHA-256 identity', () => {
  const hash = 'a'.repeat(64);
  assert.equal(requireExpectedSnapshotHash(hash.toUpperCase()), hash);
  assert.throws(
    () => requireExpectedSnapshotHash(''),
    (error) => error?.code === 'TAX_CLOSING_FINALIZATION_EXPECTED_SNAPSHOT_REQUIRED' && error?.statusCode === 400,
  );
  assert.throws(
    () => requireExpectedSnapshotHash('abc'),
    (error) => error?.code === 'TAX_CLOSING_FINALIZATION_EXPECTED_SNAPSHOT_REQUIRED',
  );
});

test('handoff bundle exposes current versus finalized snapshot integrity outside hashed source snapshot', () => {
  const service = read('src/modules/tax/handoff/taxClosingHandoffService.js');
  assert.match(service, /includeFinalizationIntegrity = true/);
  assert.match(service, /finalizationIntegrity/);
  assert.match(service, /buildIntegrity\(\{ currentSnapshotHash: snapshotHash, finalization \}\)/);
  assert.match(service, /const snapshotHash = sha256\(sourceSnapshot\)/);
});

test('tax router exposes explicit finalization endpoint under handoff boundary', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/handoff/taxClosingHandoffController.js');
  assert.match(routes, /tax-closing-handoff\/:taxPeriodId\/finalize/);
  assert.match(controller, /finalizeCurrentPackage/);
  assert.match(controller, /finalizedById/);
  assert.match(controller, /expectedSnapshotHash/);
});
