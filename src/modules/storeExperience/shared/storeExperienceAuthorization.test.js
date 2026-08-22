const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  hasStoreExperienceCapability,
} = require('./storeExperienceAuthorization');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('legacy employee context preserves historical store experience access', () => {
  const legacyEmployee = {
    role: 'EMPLOYEE',
    profileType: 'employee',
    employeeRole: null,
  };

  for (const capability of Object.values(STORE_EXPERIENCE_CAPABILITY)) {
    assert.equal(hasStoreExperienceCapability(legacyEmployee, capability), true);
  }
});

test('migrated positions require explicit store experience capabilities', () => {
  const actor = {
    role: 'EMPLOYEE',
    profileType: 'employee',
    employeeRole: 'OWNER',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ],
  };

  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.READ), true);
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.MANAGE), false);
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.PUBLISH), false);
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.MEDIA), false);

  const emptyPosition = { ...actor, positionCapabilities: [] };
  assert.equal(hasStoreExperienceCapability(emptyPosition, STORE_EXPERIENCE_CAPABILITY.READ), false);
});

test('platform admins retain store experience authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  for (const capability of Object.values(STORE_EXPERIENCE_CAPABILITY)) {
    assert.equal(hasStoreExperienceCapability(admin, capability), true);
  }
});

test('store experience routes separate read, manage, publish and media authority', () => {
  const draftRoutes = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
  const mediaRoutes = read('src/modules/storeExperience/media/storefrontMediaRoutes.js');

  assert.match(draftRoutes, /router\.get\('\/draft', allowRead/);
  assert.match(draftRoutes, /router\.put\('\/draft', allowManage/);
  assert.match(draftRoutes, /router\.post\('\/publish', allowPublish/);
  assert.match(draftRoutes, /router\.post\('\/unpublish', allowPublish/);
  assert.match(mediaRoutes, /router\.get\('\/', allowRead/);
  assert.match(mediaRoutes, /router\.post\('\/upload', allowMediaManage/);
  assert.doesNotMatch(draftRoutes, /allowEmployeeContext|employeeRole|roleOf/);
  assert.doesNotMatch(mediaRoutes, /allowEmployeeContext|employeeRole|roleOf/);
});
