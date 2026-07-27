const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCustomerConfirmation, validateFinalization, mapHandover } = require('./repairHandoverPolicy');

test('customer can confirm only a completed repair', () => {
  assert.throws(() => validateCustomerConfirmation({ status: 'IN_PROGRESS' }, { receiverName: 'สมชาย' }), { code: 'REPAIR_NOT_READY_FOR_PICKUP' });
  assert.equal(validateCustomerConfirmation({ status: 'COMPLETED' }, { receiverName: ' สมชาย ' }).receiverName, 'สมชาย');
});
test('staff finalization requires customer confirmation and all checks', () => {
  assert.throws(() => validateFinalization({ status: 'COMPLETED' }, {}, {}), { code: 'CUSTOMER_PICKUP_NOT_CONFIRMED' });
  assert.throws(() => validateFinalization({ status: 'COMPLETED' }, { customerConfirmedAt: new Date() }, { paymentConfirmed: true }), { code: 'HANDOVER_CHECKLIST_INCOMPLETE' });
  assert.equal(validateFinalization({ status: 'COMPLETED' }, { customerConfirmedAt: new Date() }, { paymentConfirmed: true, deviceReturned: true, accessoriesReturned: true }).deviceReturned, true);
});
test('handover projection contains custody milestones', () => {
  assert.equal(mapHandover({ status: 'READY', paymentConfirmed: false }).status, 'READY');
});
