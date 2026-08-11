'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildManifest,
  sha256,
} = require('../src/modules/tax/handoff/taxClosingHandoffService');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('tax closing snapshot hash is deterministic across object key order', () => {
  const left = { b: 2, a: { y: 2, x: 1 }, rows: [{ z: 3, a: 1 }] };
  const right = { rows: [{ a: 1, z: 3 }], a: { x: 1, y: 2 }, b: 2 };
  assert.equal(sha256(left), sha256(right));
  assert.notEqual(sha256(left), sha256({ ...right, b: 3 }));
});

test('handoff manifest covers tax closing exports and is not government filing authority', () => {
  const sourceSnapshot = {
    outputVat: { documents: [{ id: 1 }] },
    inputVat: { documents: [{ id: 2 }] },
    expenses: { rows: [{ id: 3 }] },
    withholding: { rows: [] },
    readiness: { summary: { blockerCount: 2 } },
  };
  const manifest = buildManifest({ periodCode: '2026-08', packageStatus: 'DRAFT_REQUIRES_ACTION', sourceSnapshot });
  assert.equal(manifest.governmentFilingAuthority, false);
  assert.equal(manifest.counts.blockers, 2);
  for (const key of ['MANIFEST', 'BUNDLE', 'OUTPUT_VAT', 'INPUT_VAT', 'TAX_EXPENSES', 'WITHHOLDING_TAX', 'PP30_SETTLEMENT']) {
    assert.ok(manifest.files.some((file) => file.key === key), `missing ${key}`);
  }
});

test('handoff package composes existing closing readiness WHT and PP30 authorities', () => {
  const source = read('src/modules/tax/handoff/taxClosingHandoffService.js');
  assert.match(source, /loadAccountingOfficePackage/);
  assert.match(source, /loadWithholdingTaxWorkspace/);
  assert.match(source, /loadUnifiedTaxReadiness/);
  assert.match(source, /loadVatSettlementPreparation/);
  assert.match(source, /TAX_CLOSING_HANDOFF_SNAPSHOT/);
  assert.match(source, /READY_FOR_HANDOFF/);
  assert.match(source, /DRAFT_REQUIRES_ACTION/);
  assert.match(source, /snapshotHash/);
  assert.match(source, /pp30:/);
});

test('tax router exposes handoff endpoint without replacing existing tax workspaces', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(routes, /tax-closing-handoff\/:taxPeriodId/);
  assert.match(routes, /accounting-office\/packages\/:taxPeriodId/);
  assert.match(routes, /tax-readiness\/:taxPeriodId/);
  assert.match(routes, /vat-settlement\/:taxPeriodId/);
  assert.match(routes, /withholding-tax\/:taxPeriodId/);
});

test('handoff controller preserves branch-scoped administrative gate', () => {
  const source = read('src/modules/tax/handoff/taxClosingHandoffController.js');
  assert.match(source, /TAX_CLOSING_HANDOFF_BRANCH_REQUIRED/);
  assert.match(source, /TAX_CLOSING_HANDOFF_ACCESS_FORBIDDEN/);
  assert.match(source, /TAX_CLOSING_HANDOFF_BRANCH_FORBIDDEN/);
  assert.match(source, /OWNER/);
  assert.match(source, /MANAGER/);
});
