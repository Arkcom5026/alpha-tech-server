'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createInputVatRecordService } = require('./inputVatRecordService');

const approvedDocument = (overrides = {}) => ({
  id: 42,
  branchId: 2,
  documentType: 'INPUT_TAX_INVOICE',
  documentNumber: 'SUP-INV-001',
  status: 'APPROVED',
  occurredAt: new Date('2026-08-09T00:00:00.000Z'),
  currency: 'THB',
  subtotalAmount: '1000.00',
  taxAmount: '70.00',
  totalAmount: '1070.00',
  counterpartyTaxId: '0100000000001',
  snapshot: { supplierName: 'Supplier A', supplierBranchCode: '00000' },
  originalTaxDocumentId: null,
  ...overrides,
});

test('approved input tax invoice creates one branch-scoped Input VAT authority record', async () => {
  const created = [];
  const tx = {
    taxPeriod: { findFirst: async () => ({ id: 'period-2026-08', branchId: 2 }) },
    inputVatRecord: {
      findUnique: async () => null,
      create: async ({ data }) => {
        created.push(data);
        return { id: 'ivr-1', ...data };
      },
    },
  };
  const service = createInputVatRecordService();
  const result = await service.recordApprovedDocument({ tx, branchId: 2, document: approvedDocument() });

  assert.equal(result.replayed, false);
  assert.equal(created.length, 1);
  assert.equal(created[0].ledgerType, 'INPUT_VAT');
  assert.equal(created[0].taxPeriodId, 'period-2026-08');
  assert.equal(created[0].replayKey, 'INPUT_VAT:2:42');
  assert.equal(created[0].taxAmount, '70.00');
});

test('Input VAT authority is replay-safe and branch isolated', async () => {
  const existing = { id: 'ivr-1', branchId: 2, taxDocumentId: 42, ledgerType: 'INPUT_VAT' };
  const tx = {
    inputVatRecord: { findUnique: async () => existing },
  };
  const service = createInputVatRecordService();
  const replay = await service.recordApprovedDocument({ tx, branchId: 2, document: approvedDocument() });
  assert.equal(replay.replayed, true);

  await assert.rejects(
    service.recordApprovedDocument({ tx, branchId: 3, document: approvedDocument() }),
    (error) => error.code === 'INPUT_VAT_DOCUMENT_BRANCH_MISMATCH',
  );
});

test('input tax report uses InputVatRecord as primary authority with explicit legacy compatibility', () => {
  const repository = fs.readFileSync(
    path.join(__dirname, '../../reporting/tax/input/runtime/inputTaxReportRuntimeRepository.js'),
    'utf8',
  );
  const service = fs.readFileSync(
    path.join(__dirname, '../../reporting/tax/input/runtime/inputTaxReportRuntimeService.js'),
    'utf8',
  );

  assert.match(repository, /prisma\.inputVatRecord\.findMany/);
  assert.match(repository, /findLegacyInputTaxReceipts/);
  assert.match(service, /authority: 'INPUT_VAT_RECORD'/);
  assert.match(service, /LEGACY_PURCHASE_RECEIPT_COMPAT/);
  assert.match(service, /authoritativeKeys/);
  assert.match(service, /INPUT_VAT_ADJUSTMENT/);
});
