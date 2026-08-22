'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const STORE_CAPABILITIES = [
  POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
];

test('legacy employee roles preserve historical store experience access', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    for (const capability of STORE_CAPABILITIES) {
      assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole }, capability), true);
    }
  }
});

test('migrated positions separate store experience read, manage and publish authority', () => {
  const readOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [POSITION_CAPABILITIES.STORE_EXPERIENCE_READ],
  };
  assert.equal(hasCapability(readOnly, POSITION_CAPABILITIES.STORE_EXPERIENCE_READ), true);
  assert.equal(hasCapability(readOnly, POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE), false);
  assert.equal(hasCapability(readOnly, POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), false);

  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };
  for (const capability of STORE_CAPABILITIES) assert.equal(hasCapability(empty, capability), false);
});

test('platform admins retain store experience authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of STORE_CAPABILITIES) {
      assert.equal(hasCapability({ role, positionCapabilities: [] }, capability), true);
    }
  }
});

test('store experience routes split read, manage, publish and media authority without direct role checks', () => {
  const draftRoutes = read('storeExperience/draft/storeExperienceDraftRoutes.js');
  const mediaRoutes = read('storeExperience/media/storefrontMediaRoutes.js');

  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.READ/);
  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.MANAGE/);
  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.PUBLISH/);
  assert.match(draftRoutes, /router\.put\('\/draft', allowManage, controller\.saveCurrentDraft\)/);
  assert.match(draftRoutes, /router\.post\('\/publish', allowPublish, controller\.publishCurrentStorefront\)/);
  assert.match(draftRoutes, /router\.post\('\/unpublish', allowPublish, controller\.unpublishCurrentStorefront\)/);
  assert.match(mediaRoutes, /router\.post\('\/upload', allowManage/);
  assert.doesNotMatch(`${draftRoutes}\n${mediaRoutes}`, /OWNER|MANAGER|CASHIER|TECHNICIAN|employeeRole|v2Role/);
});
