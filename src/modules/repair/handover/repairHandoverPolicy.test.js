const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCustomerConfirmation, validateFinalization, mapHandover } = require('./repairHandoverPolicy');

test('customer can confirm pickup only after work is ready for delivery', () => {
  assert.throws(
    () => validateCustomerConfirmation('WAITING_QC', { receiverName: 'สมชาย' }),
    { code: 'REPAIR_NOT_READY_FOR_PICKUP' }
  );
  assert.equal(
    validateCustomerConfirmation('READY_FOR_DELIVERY', { receiverName: ' สมชาย ' }).receiverName,
    'สมชาย'
  );
});

test('staff can confirm the receiver at the counter when public confirmation was skipped', () => {
  const input = validateFinalization('READY_FOR_DELIVERY', {}, {
    receiverName: ' สมชาย ใจดี ',
    handoverConfirmed: true,
  });

  assert.equal(input.receiverName, 'สมชาย ใจดี');
  assert.equal(input.paymentConfirmed, true);
  assert.equal(input.deviceReturned, true);
  assert.equal(input.accessoriesReturned, true);
});

test('staff finalization accepts one consolidated confirmation while retaining legacy checks', () => {
  const confirmed = { customerConfirmedAt: new Date() };

  assert.throws(
    () => validateFinalization('WAITING_QC', confirmed, { handoverConfirmed: true }),
    { code: 'REPAIR_NOT_READY_FOR_HANDOVER' }
  );
  assert.throws(
    () => validateFinalization('READY_FOR_DELIVERY', confirmed, {}),
    { code: 'HANDOVER_CONFIRMATION_REQUIRED' }
  );
  assert.equal(
    validateFinalization('READY_FOR_DELIVERY', confirmed, { handoverConfirmed: true }).deviceReturned,
    true
  );
  assert.equal(
    validateFinalization('READY_FOR_DELIVERY', confirmed, {
      paymentConfirmed: true,
      deviceReturned: true,
      accessoriesReturned: true,
    }).accessoriesReturned,
    true
  );
});

test('handover projection contains custody milestones', () => {
  assert.equal(mapHandover({ status: 'READY', paymentConfirmed: false }).status, 'READY');
  assert.equal(mapHandover({ status: 'DELIVERED', deviceReturned: true }).deviceReturned, true);
});
