const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const runGuard = (actor, ...capabilities) => {
  let nextCalled = false;
  let statusCode = null;
  let payload = null;
  const req = { user: actor };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };
  allowStoreExperienceCapabilities(...capabilities)(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode, payload };
};

test('legacy employees preserve historical store experience access while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole };
    assert.equal(runGuard(actor, STORE_EXPERIENCE_CAPABILITY.READ).nextCalled, true);
    assert.equal(runGuard(actor, STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.MANAGE).nextCalled, true);
    assert.equal(runGuard(actor, STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.PUBLISH).nextCalled, true);
  }
});

test('migrated positions require explicit read, manage, and publish capabilities', () => {
  const readOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ],
  };
  assert.equal(runGuard(readOnly, STORE_EXPERIENCE_CAPABILITY.READ).nextCalled, true);
  const manageDenied = runGuard(readOnly, STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.MANAGE);
  assert.equal(manageDenied.nextCalled, false);
  assert.equal(manageDenied.statusCode, 403);

  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };
  assert.equal(runGuard(empty, STORE_EXPERIENCE_CAPABILITY.READ).statusCode, 403);
});

test('platform admins retain store experience authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const actor = { role, positionCapabilities: [] };
    assert.equal(runGuard(actor, STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.MANAGE).nextCalled, true);
    assert.equal(runGuard(actor, STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.PUBLISH).nextCalled, true);
  }
});

test('draft and media routes split read, manage, and publish authority without hardcoded employee roles', () => {
  const draftSource = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const mediaSource = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draftSource, /router\.get\('\/draft', allowRead/);
  assert.match(draftSource, /router\.put\('\/draft', allowManage/);
  assert.match(draftSource, /router\.post\('\/publish', allowPublish/);
  assert.match(draftSource, /router\.post\('\/unpublish', allowPublish/);
  assert.match(mediaSource, /router\.get\('\/', allowRead/);
  assert.match(mediaSource, /router\.post\('\/upload', allowManage/);

  for (const source of [draftSource, mediaSource]) {
    assert.doesNotMatch(source, /employeeRole/);
    assert.doesNotMatch(source, /OWNER|MANAGER|CASHIER|TECHNICIAN/);
  }
});
