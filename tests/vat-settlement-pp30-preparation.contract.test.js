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

test('VAT settlement computes payable and credit without persisting a new ledger', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /netVat = amount\(outputVatAuthority - creditableInputVat\)/);
  assert.match(source, /vatPayable = amount\(Math\.max\(0, netVat\)\)/);
  assert.match(source, /vatCredit = amount\(Math\.max\(0, -netVat\)\)/);
  assert.doesNotMatch(source, /INSERT INTO "VatSettlement/);
  assert.doesNotMatch(source, /UPDATE "VatSettlement/);
});

test('VAT settlement exposes reconciliation and readiness blockers', () => {
  const source = read('src/modules/tax/settlement/vatSettlementService.js');
  assert.match(source, /outputReconciliationDifference/);
  assert.match(source, /VAT_SETTLEMENT_OUTPUT_FILING_NOT_PREPARED/);
  assert.match(source, /VAT_SETTLEMENT_INPUT_FILING_NOT_PREPARED/);
  assert.match(source, /VAT_SETTLEMENT_OUTPUT_RECONCILIATION_MISMATCH/);
  assert.match(source, /VAT_SETTLEMENT_INPUT_CREDIT_NOT_READY/);
  assert.match(source, /VAT_SETTLEMENT_PERIOD_NOT_LOCKED/);
  assert.match(source, /readyForPp30Preparation/);
});

test('tax router exposes VAT settlement preparation endpoint', () => {
  const source = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(source, /vat-settlement\/\:taxPeriodId/);
  assert.match(source, /vatSettlementController\.getPreparation/);
});
