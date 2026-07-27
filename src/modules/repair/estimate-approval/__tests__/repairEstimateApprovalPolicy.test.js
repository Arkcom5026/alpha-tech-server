const assert = require('node:assert/strict');
const test = require('node:test');
const {
  validatePublishInput,
  validateDecisionInput,
  mapApproval,
} = require('../repairEstimateApprovalPolicy');

test('publish captures immutable amount snapshot and balance', () => {
  const value = validatePublishInput(
    { estimatedCost: '1500.50', depositPaid: '300.50' },
    { expiryDays: 7, requestNote: 'รวมค่าแรงและอะไหล่' }
  );
  assert.equal(value.estimateAmount, 1500.5);
  assert.equal(value.depositAmount, 300.5);
  assert.equal(value.balanceAmount, 1200);
  assert.equal(value.requestNote, 'รวมค่าแรงและอะไหล่');
});

test('publish rejects zero estimate', () => {
  assert.throws(
    () => validatePublishInput({ estimatedCost: 0, depositPaid: 0 }),
    (error) => error.statusCode === 400 && error.code === 'ESTIMATE_AMOUNT_REQUIRED'
  );
});

test('decision requires explicit decision, approval and confirmer', () => {
  const value = validateDecisionInput({
    approvalId: 9,
    decision: 'approved',
    confirmedByName: 'สมชาย ใจดี',
  });
  assert.deepEqual(value, {
    approvalId: 9,
    decision: 'APPROVED',
    confirmedByName: 'สมชาย ใจดี',
    customerNote: null,
  });
});

test('expired pending approval projects as expired', () => {
  const value = mapApproval({
    id: 1,
    status: 'PENDING',
    estimateAmount: 500,
    depositAmount: 0,
    balanceAmount: 500,
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal(value.status, 'EXPIRED');
});
