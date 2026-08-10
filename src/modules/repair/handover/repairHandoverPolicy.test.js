const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCustomerConfirmation, validateFinalization, mapHandover } = require('./repairHandoverPolicy');

test('customer can confirm pickup only after QC passes into ready-for-delivery', () => {
  assert.throws(
    () => validateCustomerConfirmation('WAITING_QC', { receiverName: 'สมชาย' }),
    { code: 'REPAIR_NOT_READY_FOR_PICKUP' }
  );
  assert.equal(
    validateCustomerConfirmation('READY_FOR_DELIVERY', { receiverName: ' สมชาย ' }).receiverName,
    'สมชาย'
  );
});

test('staff finalization requires ready-for-delivery, customer confirmation and all checks', () => {
  const confirmed = { customerConfirmedAt: new Date() };
  const completeChecks = {
    paymentConfirmed: true,
    deviceReturned: true,
    accessoriesReturned: true,
  };

  assert.throws(
    () => validateFinalization('WAITING_QC', confirmed, completeChecks),
    { code: 'REPAIR_NOT_READY_FOR_HANDOVER' }
  );
  assert.throws(
    () => validateFinalization('READY_FOR_DELIVERY', {}, completeChecks),
    { code: 'CUSTOMER_PICKUP_NOT_CONFIRMED' }
  );
  assert.throws(
    () => validateFinalization('READY_FOR_DELIVERY', confirmed, { paymentConfirmed: true }),
    { code: 'HANDOVER_CHECKLIST_INCOMPLETE' }
  );
  assert.equal(
    validateFinalization('READY_FOR_DELIVERY', confirmed, completeChecks).deviceReturned,
    true
  );
});

test('handover projection contains custody milestones', () => {
  assert.equal(mapHandover({ status: 'READY', paymentConfirmed: false }).status, 'READY');
  assert.equal(mapHandover({ status: 'DELIVERED', deviceReturned: true }).deviceReturned, true);
});
