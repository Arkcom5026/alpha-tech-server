const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../../../shared/errors/AppError');
const { RepairError, RepairFailureCode } = require('./repairError');

test('repair failure codes remain namespaced and immutable', () => {
  assert.equal(RepairFailureCode.INVALID_INPUT, 'REPAIR_INVALID_INPUT');
  assert.equal(RepairFailureCode.INVALID_LOOKUP, 'REPAIR_INVALID_LOOKUP');
  assert.equal(RepairFailureCode.ACTIVE_REPAIR_EXISTS, 'REPAIR_ACTIVE_REPAIR_EXISTS');
  assert.equal(RepairFailureCode.ACTIVE_CLAIM_EXISTS, 'WARRANTY_ACTIVE_CLAIM_EXISTS');
  assert.equal(RepairFailureCode.INVALID_REPAIR_TRANSITION, 'REPAIR_INVALID_TRANSITION');
  assert.equal(RepairFailureCode.INVALID_CLAIM_TRANSITION, 'WARRANTY_INVALID_TRANSITION');
  assert.equal(RepairFailureCode.CONFLICT, 'REPAIR_CONFLICT');
  assert.equal(Object.isFrozen(RepairFailureCode), true);
});

test('RepairError extends AppError and preserves code, status and details', () => {
  const details = { repairJobId: 100 };
  const error = new RepairError(
    RepairFailureCode.ACTIVE_REPAIR_EXISTS,
    'มีงานซ่อมที่กำลังดำเนินการอยู่',
    409,
    details
  );

  assert.ok(error instanceof AppError);
  assert.ok(error instanceof RepairError);
  assert.equal(error.message, 'มีงานซ่อมที่กำลังดำเนินการอยู่');
  assert.equal(error.code, 'REPAIR_ACTIVE_REPAIR_EXISTS');
  assert.equal(error.statusCode, 409);
  assert.equal(error.status, 'fail');
  assert.equal(error.isOperational, true);
  assert.equal(error.details, details);
});

test('RepairError defaults to a 400 operational failure', () => {
  const error = new RepairError(RepairFailureCode.INVALID_INPUT, 'ข้อมูลไม่ถูกต้อง');

  assert.equal(error.statusCode, 400);
  assert.equal(error.status, 'fail');
  assert.equal(error.code, 'REPAIR_INVALID_INPUT');
  assert.equal(error.details, undefined);
});
