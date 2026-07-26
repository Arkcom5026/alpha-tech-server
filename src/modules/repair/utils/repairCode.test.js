const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRepairJobNo,
  createWarrantyClaimNo,
} = require('./repairCode');

test('createRepairJobNo uses branch identity and UTC compact date', () => {
  const value = createRepairJobNo('7', new Date('2026-07-04T23:59:59.000Z'));
  assert.match(value, /^RE-7-20260704-[A-Z0-9]{13}$/);
});

test('createWarrantyClaimNo uses branch identity and UTC compact date', () => {
  const value = createWarrantyClaimNo(12, new Date('2026-01-02T00:00:00.000Z'));
  assert.match(value, /^WC-12-20260102-[A-Z0-9]{13}$/);
});

test('generated repair and claim numbers are unique across repeated calls', () => {
  const now = new Date('2026-07-04T00:00:00.000Z');
  const values = new Set();

  for (let index = 0; index < 20; index += 1) {
    values.add(createRepairJobNo(1, now));
    values.add(createWarrantyClaimNo(1, now));
  }

  assert.equal(values.size, 40);
});
