'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/modules/tax/withholdingTax/withholdingTaxTreatmentService');

const makeDb = (responses, captured = []) => ({
  $transaction: async (work) => work({
    $queryRaw: async (query) => {
      captured.push(String(query));
      if (!responses.length) throw new Error('Unexpected query');
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  }),
});

test('PENDING_REVIEW can transition to WITHHOLDING_REQUIRED with audit event', async () => {
  const captured = [];
  const db = makeDb([
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'PENDING_REVIEW', withholdingTaxRate: 3, withholdingTaxAmount: 30, expenseStatus: 'RECORDED', certificateStatus: null }],
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'WITHHOLDING_REQUIRED', withholdingTaxRate: 3, withholdingTaxAmount: 30 }],
    [],
  ], captured);

  const result = await service.transitionWhtTreatment({ branchId: 2, taxExpenseItemId: 11, resultingTreatment: 'WITHHOLDING_REQUIRED', actorEmployeeId: 35 }, db);
  assert.equal(result.previousTreatment, 'PENDING_REVIEW');
  assert.equal(result.whtTreatment, 'WITHHOLDING_REQUIRED');
  assert.equal(result.withholdingTaxAmount, 30);
  assert.equal(captured.length, 3);
});

test('WITHHOLDING_REQUIRED can transition to WITHHELD', async () => {
  const db = makeDb([
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'WITHHOLDING_REQUIRED', withholdingTaxRate: 3, withholdingTaxAmount: 30, expenseStatus: 'RECORDED', certificateStatus: null }],
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'WITHHELD', withholdingTaxRate: 3, withholdingTaxAmount: 30 }],
    [],
  ]);
  const result = await service.transitionWhtTreatment({ branchId: 2, taxExpenseItemId: 11, resultingTreatment: 'WITHHELD', actorEmployeeId: 35 }, db);
  assert.equal(result.whtTreatment, 'WITHHELD');
});

test('transition cannot skip directly from PENDING_REVIEW to WITHHELD', async () => {
  const db = makeDb([
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'PENDING_REVIEW', withholdingTaxRate: 3, withholdingTaxAmount: 30, expenseStatus: 'RECORDED', certificateStatus: null }],
  ]);
  await assert.rejects(
    service.transitionWhtTreatment({ branchId: 2, taxExpenseItemId: 11, resultingTreatment: 'WITHHELD', actorEmployeeId: 35 }, db),
    (error) => error.code === 'WHT_TREATMENT_TRANSITION_INVALID',
  );
});

test('issued certificate locks treatment mutation', async () => {
  const db = makeDb([
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'WITHHOLDING_REQUIRED', withholdingTaxRate: 3, withholdingTaxAmount: 30, expenseStatus: 'RECORDED', certificateStatus: 'ISSUED' }],
  ]);
  await assert.rejects(
    service.transitionWhtTreatment({ branchId: 2, taxExpenseItemId: 11, resultingTreatment: 'WITHHELD', actorEmployeeId: 35 }, db),
    (error) => error.code === 'WHT_TREATMENT_CERTIFICATE_LOCKED',
  );
});

test('zero WHT amount cannot be confirmed as withholding-required', async () => {
  const db = makeDb([
    [{ id: 11, taxExpenseId: 5, branchId: 2, whtTreatment: 'PENDING_REVIEW', withholdingTaxRate: 0, withholdingTaxAmount: 0, expenseStatus: 'RECORDED', certificateStatus: null }],
  ]);
  await assert.rejects(
    service.transitionWhtTreatment({ branchId: 2, taxExpenseItemId: 11, resultingTreatment: 'WITHHOLDING_REQUIRED', actorEmployeeId: 35 }, db),
    (error) => error.code === 'WHT_TREATMENT_AMOUNT_REQUIRED',
  );
});
