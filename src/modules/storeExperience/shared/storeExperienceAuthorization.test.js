const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  hasStoreExperienceCapability,
} = require('./storeExperienceAuthorization');

test('legacy employees preserve historical full store experience access', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = { profileType: 'employee', employeeId: 8, employeeRole };
    assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.READ), true);
    assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.MANAGE), true);
    assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.PUBLISH), true);
  }
});

test('migrated positions require explicit store experience capabilities', () => {
  const readOnly = {
    profileType: 'employee',
    employeeId: 8,
    employeeRole: 'OWNER',
    positionCapabilities: ['store.experience.read'],
  };
  assert.equal(hasStoreExperienceCapability(readOnly, STORE_EXPERIENCE_CAPABILITY.READ), true);
  assert.equal(hasStoreExperienceCapability(readOnly, STORE_EXPERIENCE_CAPABILITY.MANAGE), false);
  assert.equal(hasStoreExperienceCapability(readOnly, STORE_EXPERIENCE_CAPABILITY.PUBLISH), false);

  const empty = { ...readOnly, positionCapabilities: [] };
  assert.equal(hasStoreExperienceCapability(empty, STORE_EXPERIENCE_CAPABILITY.READ), false);
});

test('platform admins retain all store experience authority', () => {
  const actor = { role: 'ADMIN', positionCapabilities: [] };
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.READ), true);
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.MANAGE), true);
  assert.equal(hasStoreExperienceCapability(actor, STORE_EXPERIENCE_CAPABILITY.PUBLISH), true);
});

test('store experience routes split read, manage and publish authority', () => {
  const draft = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const media = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draft, /router\.get\('\/draft', allowRead,/);
  assert.match(draft, /router\.put\('\/draft', allowManage,/);
  assert.match(draft, /router\.post\('\/publish', allowPublish,/);
  assert.match(draft, /router\.post\('\/unpublish', allowPublish,/);
  assert.match(media, /router\.get\('\/', allowRead,/);
  assert.match(media, /router\.post\('\/upload', allowManage,/);
  assert.doesNotMatch(draft, /employeeRole|OWNER|MANAGER|CASHIER|TECHNICIAN/);
  assert.doesNotMatch(media, /employeeRole|OWNER|MANAGER|CASHIER|TECHNICIAN/);
});
