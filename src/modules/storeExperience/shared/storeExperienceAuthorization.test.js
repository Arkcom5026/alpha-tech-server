'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const READ = POSITION_CAPABILITIES.STORE_EXPERIENCE_READ;
const MANAGE = POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE;
const PUBLISH = POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH;
const draftSource = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
const mediaSource = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

test('legacy employee roles preserve historical store experience access', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capabilities = legacyCapabilitiesForRole(role);
    assert.ok(capabilities.includes(READ));
    assert.ok(capabilities.includes(MANAGE));
    assert.ok(capabilities.includes(PUBLISH));
  }
});

test('migrated positions explicitly split store experience read manage and publish', () => {
  assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
  const readOnly = { role: 'EMPLOYEE', positionCapabilities: [READ] };
  assert.equal(hasCapability(readOnly, READ), true);
  assert.equal(hasCapability(readOnly, MANAGE), false);
  const manager = { role: 'EMPLOYEE', positionCapabilities: [READ, MANAGE] };
  assert.equal(hasCapability(manager, MANAGE), true);
  assert.equal(hasCapability(manager, PUBLISH), false);
});

test('platform admins retain all store experience capabilities', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of [READ, MANAGE, PUBLISH]) {
      assert.equal(hasCapability({ role, positionCapabilities: [] }, capability), true);
    }
  }
});

test('store experience routes split read manage and publish authority', () => {
  assert.match(draftSource, /router\.get\('\/draft', allowRead,/);
  assert.match(draftSource, /router\.put\('\/draft', allowManage,/);
  assert.match(draftSource, /router\.post\('\/publish', allowPublish,/);
  assert.match(draftSource, /router\.post\('\/unpublish', allowPublish,/);
  assert.match(mediaSource, /router\.get\('\/', allowRead,/);
  assert.match(mediaSource, /router\.post\('\/upload', allowManage,/);
  assert.doesNotMatch(draftSource, /OWNER|MANAGER|CASHIER|TECHNICIAN|v2Role|employeeRole/);
  assert.doesNotMatch(mediaSource, /OWNER|MANAGER|CASHIER|TECHNICIAN|v2Role|employeeRole/);
});
