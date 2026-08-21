'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const {
  SALES_TAX_FILING_CAPABILITY,
  allowSalesTaxFilingCapabilities,
} = require('./salesTaxFilingAuthorization');

const legacyActor = (employeeRole) => ({ role: 'USER', employeeRole });
const migratedActor = (capabilities) => ({
  role: 'USER',
  employeeRole: 'OWNER',
  positionCapabilities: capabilities,
});

const runGuard = (guard, user) => {
  let statusCode = null;
  let payload = null;
  let nextCalled = false;
  const req = { user };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  guard(req, res, () => { nextCalled = true; });
  return { statusCode, payload, nextCalled };
};

test('legacy authenticated employee roles preserve historical output tax filing access', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = legacyActor(role);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_PREPARE), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_SUBMIT), true);
  }
});

test('migrated positions require explicit output tax filing capabilities', () => {
  assert.equal(hasCapability(migratedActor([]), POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ), false);
  assert.equal(hasCapability(
    migratedActor([POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ]),
    POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ,
  ), true);
  assert.equal(hasCapability(
    migratedActor([POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ]),
    POSITION_CAPABILITIES.TAX_OUTPUT_FILING_PREPARE,
  ), false);
});

test('platform admin retains output tax filing authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  assert.equal(hasCapability(admin, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_READ), true);
  assert.equal(hasCapability(admin, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_PREPARE), true);
  assert.equal(hasCapability(admin, POSITION_CAPABILITIES.TAX_OUTPUT_FILING_SUBMIT), true);
});

test('submit requires both prepare and submit capabilities', () => {
  const guard = allowSalesTaxFilingCapabilities(
    SALES_TAX_FILING_CAPABILITY.PREPARE,
    SALES_TAX_FILING_CAPABILITY.SUBMIT,
  );

  const denied = runGuard(guard, migratedActor([
    POSITION_CAPABILITIES.TAX_OUTPUT_FILING_SUBMIT,
  ]));
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.payload?.code, 'SALES_TAX_FILING_FORBIDDEN');

  const allowed = runGuard(guard, migratedActor([
    POSITION_CAPABILITIES.TAX_OUTPUT_FILING_PREPARE,
    POSITION_CAPABILITIES.TAX_OUTPUT_FILING_SUBMIT,
  ]));
  assert.equal(allowed.nextCalled, true);
});
