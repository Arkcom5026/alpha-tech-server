'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  POSITION_CAPABILITIES,
} = require('../../employee/authorization/employeePositionAuthority');
const {
  InputTaxCapability,
  POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY,
  assertInputTaxAuthority,
} = require('./inputTaxAccessPolicy');

const branchId = 14;
const legacyActor = (employeeRole) => ({
  role: 'USER',
  employeeRole,
  branchId,
  employeeId: 211,
});
const migratedActor = (positionCapabilities) => ({
  role: 'USER',
  employeeRole: 'OWNER',
  positionCapabilities,
  branchId,
  employeeId: 211,
});

const assertAllowed = (user, capability, options = {}) => assertInputTaxAuthority({
  user,
  requestedBranchId: options.requestedBranchId ?? branchId,
  capability,
  requireActor: options.requireActor ?? false,
});

const assertForbidden = (user, capability, expectedCode = 'INPUT_TAX_ACCESS_FORBIDDEN') => {
  assert.throws(
    () => assertAllowed(user, capability),
    (error) => error?.statusCode === 403 && error?.code === expectedCode,
  );
};

test('legacy input tax authority preserves OWNER and MANAGER compatibility only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    for (const capability of Object.values(InputTaxCapability)) {
      assert.doesNotThrow(() => assertAllowed(legacyActor(employeeRole), capability));
    }
  }

  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assertForbidden(legacyActor(employeeRole), InputTaxCapability.VIEW);
    assertForbidden(legacyActor(employeeRole), InputTaxCapability.FILE);
  }
});

test('input tax operational capabilities map to stable position capabilities', () => {
  assert.equal(
    POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[InputTaxCapability.VIEW],
    POSITION_CAPABILITIES.TAX_INPUT_READ,
  );
  assert.equal(
    POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[InputTaxCapability.DECIDE_DUPLICATE],
    POSITION_CAPABILITIES.TAX_INPUT_REVIEW,
  );
  assert.equal(
    POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[InputTaxCapability.FILE],
    POSITION_CAPABILITIES.TAX_INPUT_FILING,
  );
  assert.equal(
    POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[InputTaxCapability.GENERATE_AUDIT_PACKAGE],
    POSITION_CAPABILITIES.TAX_INPUT_AUDIT,
  );
  assert.equal(
    POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[InputTaxCapability.REOPEN_PERIOD],
    POSITION_CAPABILITIES.TAX_INPUT_PERIOD_CONTROL,
  );
  assert.deepEqual(
    new Set(Object.keys(POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY)),
    new Set(Object.values(InputTaxCapability)),
  );
});

test('migrated positions require the explicit input tax capability for each authority family', () => {
  const readOnly = migratedActor([POSITION_CAPABILITIES.TAX_INPUT_READ]);
  assert.doesNotThrow(() => assertAllowed(readOnly, InputTaxCapability.VIEW));
  assert.doesNotThrow(() => assertAllowed(readOnly, InputTaxCapability.EXPORT));
  assertForbidden(readOnly, InputTaxCapability.REVIEW);
  assertForbidden(readOnly, InputTaxCapability.FILE);

  const filingOnly = migratedActor([POSITION_CAPABILITIES.TAX_INPUT_FILING]);
  assert.doesNotThrow(() => assertAllowed(filingOnly, InputTaxCapability.SELECT_FOR_FILING));
  assert.doesNotThrow(() => assertAllowed(filingOnly, InputTaxCapability.REMOVE_FROM_FILING));
  assert.doesNotThrow(() => assertAllowed(filingOnly, InputTaxCapability.FILE));
  assertForbidden(filingOnly, InputTaxCapability.VIEW);

  assertForbidden(migratedActor([]), InputTaxCapability.VIEW);
});

test('platform admin, branch isolation, and authenticated mutation actor semantics remain intact', () => {
  assert.doesNotThrow(() => assertAllowed({
    role: 'ADMIN',
    branchId: 999,
  }, InputTaxCapability.REOPEN_PERIOD, { requestedBranchId: branchId }));

  assert.throws(
    () => assertAllowed(migratedActor([POSITION_CAPABILITIES.TAX_INPUT_READ]), InputTaxCapability.VIEW, {
      requestedBranchId: branchId + 1,
    }),
    (error) => error?.statusCode === 403 && error?.code === 'INPUT_TAX_BRANCH_FORBIDDEN',
  );

  assert.throws(
    () => assertAllowed({
      ...migratedActor([POSITION_CAPABILITIES.TAX_INPUT_REVIEW]),
      employeeId: null,
    }, InputTaxCapability.REVIEW, { requireActor: true }),
    (error) => error?.statusCode === 403 && error?.code === 'INPUT_TAX_ACTOR_REQUIRED',
  );
});
