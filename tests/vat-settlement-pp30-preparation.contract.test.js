'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('VAT settlement preparation uses output authority and claimed input VAT authority', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /loadAccountingOfficePackage/);
  assert.match(source, /FROM "SalesTaxFilingBatch" batch/);
  assert.match(source, /FROM "InputTaxFilingBatch" batch/);
  assert.match(source, /item\."claimedVatAmount"/);
  assert.match(source, /inputVatLedgerType/);
  assert.match(source, /INPUT_VAT_ADJUSTMENT/);
});

test('VAT settlement applies only confirmed carry-forward authority to PP30 result', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /FROM "VatCarryForwardAuthority"/);
  assert.match(source, /'CONFIRMED'::"VatCarryForwardStatus"/);
  assert.match(source, /currentPeriodNetVat = amount\(outputVatAuthority - creditableInputVat\)/);
  assert.match(source, /pp30NetVatAfterCarryForward/);
  assert.match(source, /currentPeriodNetVat - carryForwardAmount/);
  assert.match(source, /pp30VatPayable/);
  assert.match(source, /pp30VatCredit/);
  assert.doesNotMatch(source, /INSERT INTO "VatSettlement/);
  assert.doesNotMatch(source, /UPDATE "VatSettlement/);
});

test('PP30 readiness requires explicit prior-period or historical-opening authority', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /expectedCarryForwardSourceType = previousPeriod \? 'PRIOR_PERIOD' : 'HISTORICAL_OPENING'/);
  assert.match(source, /carryForwardSourceMatches/);
  assert.match(source, /carryForwardAuthorityReady/);
  assert.match(source, /VAT_SETTLEMENT_CARRY_FORWARD_AUTHORITY_REQUIRED/);
  assert.match(source, /VAT_SETTLEMENT_HISTORICAL_OPENING_AUTHORITY_REQUIRED/);
  assert.match(source, /HISTORICAL_OPENING_AUTHORITY_REQUIRED/);
  assert.match(source, /readyForCurrentPeriodSettlement/);
  assert.match(source, /readyForPp30Preparation/);
});

test('carry-forward confirmation is branch scoped, versioned and mutable while locked but immutable after submit', () => {
  const source = read('src/modules/tax/settlement/vatCarryForwardService.js');
  assert.match(source, /"branchId" = \$\{branchId\}/);
  assert.match(source, /String\(target\.status\) === 'SUBMITTED'/);
  assert.doesNotMatch(source, /\['LOCKED', 'SUBMITTED'\]\.includes\(String\(target\.status\)\)/);
  assert.match(source, /VAT_CARRY_FORWARD_PERIOD_IMMUTABLE/);
  assert.match(source, /VAT_CARRY_FORWARD_PREVIOUS_PERIOD_NOT_FINALIZED/);
  assert.match(source, /HISTORICAL_OPENING/);
  assert.match(source, /"version" = "VatCarryForwardAuthority"\."version" \+ 1/);
  assert.match(source, /sourceSnapshot/);
  assert.match(source, /'CONFIRMED'::"VatCarryForwardStatus"/);
});

test('prior-period carry-forward is derived from ready PP30 settlement and capped by source credit', () => {
  const source = read('src/modules/tax/settlement/vatCarryForwardService.js');
  assert.match(source, /loadPriorPeriodSettlement/);
  assert.match(source, /vatSettlementService\.loadVatSettlementPreparation/);
  assert.match(source, /readyForPp30Preparation/);
  assert.match(source, /suggestedAmount/);
  assert.match(source, /VAT_CARRY_FORWARD_SOURCE_SETTLEMENT_NOT_READY/);
  assert.match(source, /VAT_CARRY_FORWARD_AMOUNT_EXCEEDS_SOURCE_CREDIT/);
  assert.match(source, /availableCredit/);
  assert.match(source, /sourceAvailableCredit/);
});

test('carry-forward Prisma foundation is additive and tax-period scoped', () => {
  const schema = read('prisma/tax/vat-settlement.prisma');
  const taxSchema = read('prisma/tax/tax-document.prisma');
  const migration = read('prisma/migrations/20260810104500_vat_carry_forward_authority/migration.sql');
  assert.match(schema, /model VatCarryForwardAuthority/);
  assert.match(schema, /@@unique\(\[branchId, taxPeriodId\]\)/);
  assert.match(schema, /VatCarryForwardSourceType/);
  assert.match(schema, /sourceSnapshot/);
  assert.match(schema, /version\s+Int\s+@default\(1\)/);
  assert.match(taxSchema, /vatCarryForwardAuthority/);
  assert.match(taxSchema, /vatCarryForwardSources/);
  assert.match(migration, /CREATE TABLE "VatCarryForwardAuthority"/);
  assert.match(migration, /FOREIGN KEY \("taxPeriodId", "branchId"\)/);
  assert.doesNotMatch(migration, /UPDATE "TaxPeriod"/);
  assert.doesNotMatch(migration, /INSERT INTO "VatCarryForwardAuthority"/);
});

test('VAT carry-forward migration verifier casts regclass to text and enforces zero backfill', () => {
  const source = read('scripts/verify-vat-carry-forward-migration.js');
  assert.match(source, /to_regclass\('public\."\$\{TABLE_NAME\}"'\)::text AS "tableName"/);
  assert.match(source, /finished_at/);
  assert.match(source, /rolled_back_at/);
  assert.match(source, /rowCount !== 0/);
  assert.match(source, /must not backfill authority rows/);
});

test('VAT settlement exposes reconciliation and readiness blockers', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /outputReconciliationDifference/);
  assert.match(source, /VAT_SETTLEMENT_OUTPUT_FILING_NOT_PREPARED/);
  assert.match(source, /VAT_SETTLEMENT_INPUT_FILING_NOT_PREPARED/);
  assert.match(source, /VAT_SETTLEMENT_OUTPUT_RECONCILIATION_MISMATCH/);
  assert.match(source, /VAT_SETTLEMENT_INPUT_CREDIT_NOT_READY/);
  assert.match(source, /VAT_SETTLEMENT_PERIOD_NOT_LOCKED/);
});

test('tax period submit requires PP30 settlement readiness after filing submission gates', () => {
  const source = read('src/modules/tax/periods/taxPeriodService.js');
  assert.match(source, /vatSettlementService\.loadVatSettlementPreparation/);
  assert.match(source, /settlement\.readiness\?\.readyForPp30Preparation/);
  assert.match(source, /TAX_PERIOD_VAT_SETTLEMENT_NOT_READY/);
  assert.match(source, /exceptionCodes/);
  assert.match(source, /TAX_PERIOD_OUTPUT_FILING_NOT_SUBMITTED/);
  assert.match(source, /TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED/);
  assert.ok(
    source.indexOf('TAX_PERIOD_OUTPUT_FILING_NOT_SUBMITTED') < source.indexOf('TAX_PERIOD_VAT_SETTLEMENT_NOT_READY'),
    'output filing submit gate must precede settlement gate',
  );
  assert.ok(
    source.indexOf('TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED') < source.indexOf('TAX_PERIOD_VAT_SETTLEMENT_NOT_READY'),
    'input filing submit gate must precede settlement gate',
  );
});

test('tax router exposes settlement and carry-forward authority endpoints', () => {
  const source = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(source, /vat-settlement\/\:taxPeriodId/);
  assert.match(source, /vatSettlementController\.getPreparation/);
  assert.match(source, /vat-carry-forward\/\:taxPeriodId/);
  assert.match(source, /vatCarryForwardController\.getAuthority/);
  assert.match(source, /vatCarryForwardController\.confirmAuthority/);
});
