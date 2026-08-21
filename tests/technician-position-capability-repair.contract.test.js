'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  legacyCapabilitiesForRole,
} = require('../src/modules/employee/authorization/employeePositionAuthority');

const expected = legacyCapabilitiesForRole('TECHNICIAN');

for (const capability of [
  'repair.read',
  'repair.workflow',
  'repair.parts',
  'inventory.audit',
  'inventory.audit.finalize',
  'inventory.receive',
  'inventory.lifecycle',
  'inventory.quick-stock',
]) {
  assert(expected.includes(capability), `TECHNICIAN compatibility set must preserve ${capability}`);
}

assert(!expected.includes('employee.manage'));
assert(!expected.includes('inventory.adjust'));
assert(!expected.includes('inventory.transfer'));

const script = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'repair-position-capabilities.js'),
  'utf8',
);

assert(script.includes("ALLOW_MAIN_DATABASE_POSITION_CAPABILITY_REPAIR !== 'YES'"));
assert(script.includes('CONFIRM_POSITION_CAPABILITY_REPAIR_SCOPE'));
assert(script.includes("profile !== 'TECHNICIAN'"));
assert(script.includes("where: { id: positionId, branchId }"));
assert(script.includes("if (before !== null)"));
assert(script.includes('refusing overwrite'));
assert(script.includes('legacyCapabilitiesForRole(profile)'));

console.log('technician-position-capability-repair.contract.test.js: PASS');
