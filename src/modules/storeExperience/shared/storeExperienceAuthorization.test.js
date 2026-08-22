'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');
const {
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const runGuard = (actor, ...requiredCapabilities) => new Promise((resolve) => {
  allowStoreExperienceCapabilities(...requiredCapabilities)(
    { user: actor },
    {},
    (error) => resolve(error || null),
  );
});

test('legacy employee roles preserve historical broad store experience access', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capabilities = legacyCapabilitiesForRole(role);
    assert.equal(capabilities.includes(STORE_EXPERIENCE_CAPABILITY.READ), true, role);
    assert.equal(capabilities.includes(STORE_EXPERIENCE_CAPABILITY.MANAGE), true, role);
    assert.equal(capabilities.includes(STORE_EXPERIENCE_CAPABILITY.PUBLISH), true, role);
  }
});

test('migrated positions require explicit store experience capabilities', async () => {
  const migratedEmpty = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  };
  assert.equal(hasCapability(migratedEmpty, STORE_EXPERIENCE_CAPABILITY.READ), false);

  const readOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ],
  };
  assert.equal(await runGuard(readOnly, STORE_EXPERIENCE_CAPABILITY.READ), null);
  const manageError = await runGuard(
    readOnly,
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
  );
  assert.equal(manageError?.statusCode, 403);
  assert.equal(manageError?.code, 'FORBIDDEN_STORE_EXPERIENCE_ACCESS');
});

test('platform admins retain store experience authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  assert.equal(hasCapability(admin, STORE_EXPERIENCE_CAPABILITY.READ), true);
  assert.equal(hasCapability(admin, STORE_EXPERIENCE_CAPABILITY.MANAGE), true);
  assert.equal(hasCapability(admin, STORE_EXPERIENCE_CAPABILITY.PUBLISH), true);
});

test('store experience routes split read, manage, publish and media authority', () => {
  const draftRoutes = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
  const mediaRoutes = read('src/modules/storeExperience/media/storefrontMediaRoutes.js');

  assert.match(draftRoutes, /router\.get\('\/draft', allowRead, controller\.getCurrentDraft\)/);
  assert.match(draftRoutes, /router\.put\('\/draft', allowManage, controller\.saveCurrentDraft\)/);
  assert.match(draftRoutes, /router\.post\('\/publish', allowPublish, controller\.publishCurrentStorefront\)/);
  assert.match(draftRoutes, /router\.post\('\/unpublish', allowPublish, controller\.unpublishCurrentStorefront\)/);
  assert.match(mediaRoutes, /router\.get\('\/', allowRead, controller\.listStorefrontMedia\)/);
  assert.match(mediaRoutes, /router\.post\('\/upload', allowManage,/);
  assert.doesNotMatch(draftRoutes, /roleOf|employeeRole|SUPPERADMIN/);
  assert.doesNotMatch(mediaRoutes, /roleOf|employeeRole|SUPPERADMIN/);
});
