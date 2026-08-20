'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PREPARATION_STATUSES,
  TAX_PORTIONS,
  TAX_INVOICE_KINDS,
  OUT_OF_BUDGET_LINE_TYPE,
  buildPreparationTaxProjection,
} = require('../src/modules/sales/document-preparation/documentPreparationPolicy');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Wave 0 authority uses one mutable draft and explicitly excludes quotation-style revision history', () => {
  const mission = read('docs/missions/sale-document-preparation-tax-projection-wave0.md');

  assert.match(mission, /one branch-scoped mutable preparation draft/i);
  assert.match(mission, /no revision chain/i);
  assert.match(mission, /revisionNumber/);
  assert.match(mission, /revisionRootId/);
  assert.match(mission, /revisedFromId/);
  assert.match(mission, /Generic document engine/i);

  assert.deepEqual(PREPARATION_STATUSES, {
    DRAFT: 'DRAFT',
    LOCKED: 'LOCKED',
    CANCELLED: 'CANCELLED',
  });
});

test('equal source and prepared totals project one full-tax portion only', () => {
  const projection = buildPreparationTaxProjection({
    sourceTotal: 4000,
    lines: [
      { description: 'Toner', quantity: 2, unitPrice: 1500 },
      { description: 'Paper', quantity: 2, unitPrice: 500 },
    ],
  });

  assert.equal(projection.sourceTotal, 4000);
  assert.equal(projection.documentTotal, 4000);
  assert.equal(projection.outOfBudgetTotal, 0);
  assert.equal(projection.projections.length, 1);
  assert.deepEqual(projection.projections[0], {
    portion: TAX_PORTIONS.IN_BUDGET,
    taxInvoiceKind: TAX_INVOICE_KINDS.FULL,
    totalAmount: 4000,
    requiresRecipientIdentity: true,
    lineType: 'MANUAL_DOCUMENT_LINES',
  });
});

test('source difference projects full agency amount plus short service-only amount', () => {
  const projection = buildPreparationTaxProjection({
    sourceTotal: 5000,
    lines: [
      { description: 'Prepared agency document lines', quantity: 1, amount: 4000 },
    ],
  });

  assert.equal(projection.documentTotal, 4000);
  assert.equal(projection.outOfBudgetTotal, 1000);
  assert.equal(projection.projections.length, 2);

  assert.deepEqual(projection.projections[0], {
    portion: TAX_PORTIONS.IN_BUDGET,
    taxInvoiceKind: TAX_INVOICE_KINDS.FULL,
    totalAmount: 4000,
    requiresRecipientIdentity: true,
    lineType: 'MANUAL_DOCUMENT_LINES',
  });

  assert.deepEqual(projection.projections[1], {
    portion: TAX_PORTIONS.OUT_OF_BUDGET,
    taxInvoiceKind: TAX_INVOICE_KINDS.SHORT,
    totalAmount: 1000,
    requiresRecipientIdentity: false,
    lineType: OUT_OF_BUDGET_LINE_TYPE,
  });

  const total = projection.projections.reduce((sum, item) => sum + item.totalAmount, 0);
  assert.equal(total, projection.sourceTotal);
});

test('prepared document total cannot exceed source transaction truth', () => {
  assert.throws(
    () => buildPreparationTaxProjection({
      sourceTotal: 4000,
      lines: [{ description: 'Prepared line', quantity: 1, amount: 4000.01 }],
    }),
    (error) => error?.code === 'DOCUMENT_PREPARATION_TOTAL_EXCEEDS_SOURCE'
      && error?.statusCode === 409,
  );
});

test('Wave 0 does not alter the existing one-candidate-per-source tax authority or Output VAT ledger ownership', () => {
  const taxSchema = read('prisma/tax/tax-document.prisma');
  const taxCandidateContract = read('src/modules/tax/candidates/contracts/taxCandidateContract.js');
  const outputVatService = read('src/modules/tax/outputVat/outputVatRecordService.js');

  assert.match(taxSchema, /@@unique\(\[branchId, sourceType, sourceId\]\)/);
  assert.match(taxCandidateContract, /registrationKey: \[normalizedBranchId, normalizedSourceType, normalizedSourceId\]\.join\(':'\)/);
  assert.match(outputVatService, /taxDocumentId: Number\(document\.id\)/);
  assert.match(outputVatService, /ledgerType: expectedLedgerType/);
});

test('Wave 0 leaves Sale/Stock/CustomerMoney mutation outside preparation policy', () => {
  const policy = read('src/modules/sales/document-preparation/documentPreparationPolicy.js');

  assert.doesNotMatch(policy, /prisma\./);
  assert.doesNotMatch(policy, /sale\.update|saleItem\.update|stockItem\.update|simpleLot\.update/i);
  assert.doesNotMatch(policy, /customerMoney|payment\.create|stockMovement/i);
  assert.doesNotMatch(policy, /productId|stockItemId|simpleLotId|saleItemId/);
});
