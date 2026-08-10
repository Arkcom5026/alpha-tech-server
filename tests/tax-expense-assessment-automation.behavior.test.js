'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaxExpenseAssessmentService } = require('../src/modules/tax-expense/assessment/taxExpenseAssessmentService');

const expenseFixture = ({
  items,
  assessments = [],
  evidenceStatus = 'VERIFIED',
  documentNumber = 'INV-001',
} = {}) => ({
  id: 41,
  branchId: 2,
  expenseNumber: 'TE-20260810-0001',
  expenseDate: new Date('2026-08-10T00:00:00.000Z'),
  evidenceStatus,
  documentNumber,
  items: items || [{
    id: 101,
    taxExpenseId: 41,
    branchId: 2,
    lineNumber: 1,
    description: 'ค่าบริการ',
    vatAmount: '70.00',
    withholdingTaxAmount: '30.00',
    vatTreatment: 'PENDING_REVIEW',
    citTreatment: 'PENDING_REVIEW',
    whtTreatment: 'PENDING_REVIEW',
    category: { id: 7, code: 'SERVICE', name: 'ค่าบริการ' },
  }],
  assessments,
});

const fakeClient = ({ expense, submittedPeriod = null, updateCounts = [1] } = {}) => {
  const calls = { itemUpdates: [], assessmentUpdates: [], assessmentCreates: [] };
  let updateIndex = 0;
  const tx = {
    taxExpense: {
      findFirst: async () => expense,
    },
    taxPeriod: {
      findFirst: async () => submittedPeriod,
    },
    taxExpenseItem: {
      updateMany: async (args) => {
        calls.itemUpdates.push(args);
        const count = updateCounts[updateIndex] ?? 1;
        updateIndex += 1;
        return { count };
      },
    },
    taxExpenseAssessment: {
      update: async (args) => {
        calls.assessmentUpdates.push(args);
        return args;
      },
      create: async (args) => {
        calls.assessmentCreates.push(args);
        return { id: 900 + calls.assessmentCreates.length, ...args.data };
      },
    },
  };
  return {
    calls,
    client: {
      ...tx,
      $transaction: async (work) => work(tx),
    },
  };
};

test('suggestion remains proposal-only, eligibility-gated and preserves WHT workflow authority', async () => {
  const { client } = fakeClient({ expense: expenseFixture() });
  const service = new TaxExpenseAssessmentService(client);
  const result = await service.getSuggestion({ branchId: 2, taxExpenseId: 41 });

  assert.equal(result.suggestion.autoFinalize, false);
  assert.equal(result.suggestion.authority, 'RULE_ASSISTED_HUMAN_CONFIRMATION');
  assert.equal(result.suggestion.items[0].suggestions.vat.treatment, 'PENDING_REVIEW');
  assert.equal(result.suggestion.items[0].suggestions.vat.confidence, 'MEDIUM');
  assert.equal(result.suggestion.items[0].suggestions.vat.reasonCode, 'INPUT_VAT_ELIGIBILITY_AUTHORITY_REQUIRED');
  assert.equal(result.suggestion.items[0].suggestions.cit.treatment, 'PENDING_REVIEW');
  assert.equal(result.suggestion.items[0].suggestions.wht.action, 'REVIEW_IN_WHT_WORKSPACE');
});

test('zero VAT is safely suggested as out of scope', async () => {
  const item = { ...expenseFixture().items[0], vatAmount: '0.00', withholdingTaxAmount: '0.00', whtTreatment: 'NOT_APPLICABLE' };
  const { client } = fakeClient({ expense: expenseFixture({ items: [item] }) });
  const service = new TaxExpenseAssessmentService(client);
  const result = await service.getSuggestion({ branchId: 2, taxExpenseId: 41 });

  assert.equal(result.suggestion.items[0].suggestions.vat.treatment, 'OUT_OF_SCOPE');
  assert.equal(result.suggestion.items[0].suggestions.vat.confidence, 'HIGH');
  assert.equal(result.suggestion.items[0].suggestions.vat.reasonCode, 'NO_VAT_AMOUNT_RECORDED');
});

test('human confirmation writes VAT/CIT only, creates finalized version and keeps WHT separate', async () => {
  const { client, calls } = fakeClient({ expense: expenseFixture() });
  const service = new TaxExpenseAssessmentService(client);
  const result = await service.confirm({
    branchId: 2,
    employeeId: 35,
    taxExpenseId: 41,
    decisions: [{ taxExpenseItemId: 101, vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' }],
    note: 'reviewed',
  });

  assert.equal(calls.itemUpdates.length, 1);
  assert.deepEqual(calls.itemUpdates[0].data, { vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' });
  assert.equal(calls.assessmentCreates.length, 1);
  assert.equal(calls.assessmentCreates[0].data.version, 1);
  assert.equal(calls.assessmentCreates[0].data.status, 'FINALIZED');
  assert.equal(result.snapshot.whtAuthority, 'SEPARATE_WHT_WORKFLOW');
  assert.equal(typeof calls.assessmentCreates[0].data.assessmentHash, 'string');
  assert.equal(calls.assessmentCreates[0].data.assessmentHash.length, 64);
});

test('reconfirmation supersedes prior finalized assessment and increments version', async () => {
  const previous = { id: 88, version: 3, status: 'FINALIZED' };
  const { client, calls } = fakeClient({ expense: expenseFixture({ assessments: [previous] }) });
  const service = new TaxExpenseAssessmentService(client);

  await service.confirm({
    branchId: 2,
    employeeId: 35,
    taxExpenseId: 41,
    decisions: [{ taxExpenseItemId: 101, vatTreatment: 'NON_CREDITABLE', citTreatment: 'NON_DEDUCTIBLE' }],
  });

  assert.equal(calls.assessmentUpdates.length, 1);
  assert.deepEqual(calls.assessmentUpdates[0], { where: { id: 88 }, data: { status: 'SUPERSEDED' } });
  assert.equal(calls.assessmentCreates[0].data.version, 4);
});

test('duplicate item decisions are rejected before any write', async () => {
  const expense = expenseFixture({
    items: [
      expenseFixture().items[0],
      { ...expenseFixture().items[0], id: 102, lineNumber: 2, description: 'ค่าบริการ 2' },
    ],
  });
  const { client, calls } = fakeClient({ expense });
  const service = new TaxExpenseAssessmentService(client);

  await assert.rejects(
    service.confirm({
      branchId: 2,
      employeeId: 35,
      taxExpenseId: 41,
      decisions: [
        { taxExpenseItemId: 101, vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' },
        { taxExpenseItemId: 101, vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' },
      ],
    }),
    (error) => error.code === 'TAX_EXPENSE_ASSESSMENT_DUPLICATE_ITEM',
  );
  assert.equal(calls.itemUpdates.length, 0);
});

test('submitted tax period rejects assessment mutation before any write', async () => {
  const { client, calls } = fakeClient({
    expense: expenseFixture(),
    submittedPeriod: { id: 'period-2026-08', periodCode: '2026-08' },
  });
  const service = new TaxExpenseAssessmentService(client);

  await assert.rejects(
    service.confirm({
      branchId: 2,
      employeeId: 35,
      taxExpenseId: 41,
      decisions: [{ taxExpenseItemId: 101, vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' }],
    }),
    (error) => error.code === 'TAX_EXPENSE_ASSESSMENT_PERIOD_IMMUTABLE' && error.statusCode === 409,
  );
  assert.equal(calls.itemUpdates.length, 0);
  assert.equal(calls.assessmentCreates.length, 0);
});

test('concurrent item modification aborts confirmation before assessment is created', async () => {
  const { client, calls } = fakeClient({ expense: expenseFixture(), updateCounts: [0] });
  const service = new TaxExpenseAssessmentService(client);

  await assert.rejects(
    service.confirm({
      branchId: 2,
      employeeId: 35,
      taxExpenseId: 41,
      decisions: [{ taxExpenseItemId: 101, vatTreatment: 'CREDITABLE', citTreatment: 'DEDUCTIBLE' }],
    }),
    (error) => error.code === 'TAX_EXPENSE_ASSESSMENT_CONCURRENT_MODIFICATION' && error.statusCode === 409,
  );
  assert.equal(calls.assessmentCreates.length, 0);
});
