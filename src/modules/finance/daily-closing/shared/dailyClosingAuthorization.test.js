'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const { DAILY_CLOSING_CAPABILITY } = require('./dailyClosingAuthorization');

const READ = POSITION_CAPABILITIES.FINANCE_DAILY_CLOSING_READ;
const routeSource = fs.readFileSync(path.join(__dirname, '../routes/dailyClosingRoutes.js'), 'utf8');

test('legacy employee roles preserve historical authenticated-only daily closing access', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.ok(
      legacyCapabilitiesForRole(role).includes(READ),
      `${role} should retain daily closing read compatibility`,
    );
  }
});

test('migrated positions require explicit daily closing read capability', () => {
  const allowed = { role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: [READ] };
  const denied = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };

  assert.equal(hasCapability(allowed, READ), true);
  assert.equal(hasCapability(denied, READ), false);
});

test('platform admins retain daily closing read authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, DAILY_CLOSING_CAPABILITY.READ), true);
  }
});

test('daily closing route is position-gated while controller retains branch isolation', () => {
  assert.match(
    routeSource,
    /router\.get\('\/daily-closing-summary', requireDailyClosingRead, getDailyClosingSummary\)/,
  );
  assert.doesNotMatch(routeSource, /OWNER|MANAGER|CASHIER|TECHNICIAN|employeeRole|v2Role/);
});
