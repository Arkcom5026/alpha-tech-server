const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const invoke = (middleware, user) => {
  const result = { nextCalled: false, status: null, body: null };
  const req = { user };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return body;
    },
  };
  middleware(req, res, () => {
    result.nextCalled = true;
  });
  return result;
};

test('legacy employees preserve historical broad store experience access', () => {
  const guard = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );

  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(invoke(guard, { role: 'EMPLOYEE', employeeRole }).nextCalled, true);
  }
});

test('migrated positions require explicit store experience capabilities', () => {
  const readGuard = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
  const publishGuard = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );

  assert.equal(invoke(readGuard, {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  }).status, 403);

  assert.equal(invoke(publishGuard, {
    role: 'EMPLOYEE',
    employeeRole: 'TECHNICIAN',
    positionCapabilities: [
      STORE_EXPERIENCE_CAPABILITY.READ,
      STORE_EXPERIENCE_CAPABILITY.MANAGE,
      STORE_EXPERIENCE_CAPABILITY.PUBLISH,
    ],
  }).nextCalled, true);
});

test('store experience routes split read, manage and publish authority without hard-coded employee roles', () => {
  const draftSource = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const mediaSource = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draftSource, /router\.get\('\/draft', allowRead/);
  assert.match(draftSource, /router\.put\('\/draft', allowManage/);
  assert.match(draftSource, /router\.post\('\/publish', allowPublish/);
  assert.match(draftSource, /router\.post\('\/unpublish', allowPublish/);
  assert.match(mediaSource, /router\.get\('\/', allowRead/);
  assert.match(mediaSource, /router\.post\('\/upload', allowManage/);

  for (const source of [draftSource, mediaSource]) {
    assert.doesNotMatch(source, /OWNER|MANAGER|CASHIER|TECHNICIAN|employeeRole|roleOf/);
  }
});
