const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertRepairNotHeldByActiveSubcontract,
} = require('./subcontractRepairHoldPolicy');

class TestError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

test('active subcontract holds the internal repair workflow', () => {
  assert.throws(
    () => assertRepairNotHeldByActiveSubcontract(
      { id: 17, status: 'SENT', providerName: 'ร้านซับนอก' },
      TestError
    ),
    (error) => {
      assert.equal(error.code, 'REPAIR_ACTIVE_SUBCONTRACT_HOLD');
      assert.equal(error.details.repairSubcontractId, 17);
      assert.equal(error.details.subcontractStatus, 'SENT');
      assert.equal(error.details.providerName, 'ร้านซับนอก');
      return true;
    }
  );
});

test('returned subcontract does not hold workflow when no active row is supplied', () => {
  assert.equal(assertRepairNotHeldByActiveSubcontract(null, TestError), null);
});
