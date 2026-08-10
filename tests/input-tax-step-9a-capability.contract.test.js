'use strict';

const assert = require('assert');
const {
  InputTaxCapability,
  assertInputTaxAuthority,
} = require('../src/modules/tax/policies/inputTaxAccessPolicy');

const owner = { role: 'EMPLOYEE', employeeRole: 'OWNER', employeeId: 11, branchId: 1 };
const manager = { role: 'EMPLOYEE', employeeRole: 'MANAGER', employeeId: 12, branchId: 1 };
const cashier = { role: 'EMPLOYEE', employeeRole: 'CASHIER', employeeId: 13, branchId: 1 };
const admin = { role: 'ADMIN', employeeRole: 'CASHIER', employeeId: 14, branchId: 1 };

for (const capability of Object.values(InputTaxCapability)) {
  assert.doesNotThrow(() => assertInputTaxAuthority({
    user: owner,
    requestedBranchId: 1,
    capability,
    requireActor: true,
  }));
  assert.doesNotThrow(() => assertInputTaxAuthority({
    user: manager,
    requestedBranchId: 1,
    capability,
    requireActor: true,
  }));
  assert.doesNotThrow(() => assertInputTaxAuthority({
    user: admin,
    requestedBranchId: 2,
    capability,
    requireActor: true,
  }));
}

assert.throws(
  () => assertInputTaxAuthority({
    user: cashier,
    requestedBranchId: 1,
    capability: InputTaxCapability.DECIDE_DUPLICATE,
    accessForbiddenCode: 'INPUT_TAX_DECISION_ACCESS_FORBIDDEN',
    requireActor: true,
  }),
  (error) => error?.code === 'INPUT_TAX_DECISION_ACCESS_FORBIDDEN' && error?.statusCode === 403,
);

assert.throws(
  () => assertInputTaxAuthority({
    user: manager,
    requestedBranchId: 2,
    capability: InputTaxCapability.SELECT_FOR_FILING,
    branchForbiddenCode: 'INPUT_TAX_FILING_BRANCH_FORBIDDEN',
    requireActor: true,
  }),
  (error) => error?.code === 'INPUT_TAX_FILING_BRANCH_FORBIDDEN' && error?.statusCode === 403,
);

assert.throws(
  () => assertInputTaxAuthority({
    user: { role: 'EMPLOYEE', employeeRole: 'OWNER', branchId: 1 },
    requestedBranchId: 1,
    capability: InputTaxCapability.FILE,
    actorRequiredCode: 'INPUT_TAX_FILING_ACTOR_REQUIRED',
    requireActor: true,
  }),
  (error) => error?.code === 'INPUT_TAX_FILING_ACTOR_REQUIRED' && error?.statusCode === 403,
);

console.log('input tax step 9A capability contract: PASS');
