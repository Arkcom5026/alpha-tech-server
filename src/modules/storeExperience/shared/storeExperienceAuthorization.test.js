const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const runGuard = (user, ...required) => {
  let nextCalled = false;
  let statusCode = null;
  let payload = null;
  const req = { user };
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  allowStoreExperienceCapabilities(...required)(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, payload };
};

test('legacy employees preserve historical store experience access', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(
      runGuard(
        { role: 'EMPLOYEE', employeeRole },
        STORE_EXPERIENCE_CAPABILITY.MANAGE,
        STORE_EXPERIENCE_CAPABILITY.PUBLISH,
      ).nextCalled,
      true,
    );
  }
});

test('migrated positions split manage from publish authority', () => {
  assert.equal(
    runGuard(
      { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.MANAGE] },
      STORE_EXPERIENCE_CAPABILITY.MANAGE,
    ).nextCalled,
    true,
  );
  const deniedPublish = runGuard(
    { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.MANAGE] },
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );
  assert.equal(deniedPublish.nextCalled, false);
  assert.equal(deniedPublish.statusCode, 403);

  const emptyPosition = runGuard(
    { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] },
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
  );
  assert.equal(emptyPosition.nextCalled, false);
});

test('platform admins retain store experience authority', () => {
  assert.equal(
    runGuard(
      { role: 'ADMIN', positionCapabilities: [] },
      STORE_EXPERIENCE_CAPABILITY.MANAGE,
      STORE_EXPERIENCE_CAPABILITY.PUBLISH,
    ).nextCalled,
    true,
  );
});

test('store experience routes apply manage and publish boundaries', () => {
  const draftSource = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const mediaSource = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draftSource, /router\.get\('\/draft', canManage,/);
  assert.match(draftSource, /router\.put\('\/draft', canManage,/);
  assert.match(draftSource, /router\.post\('\/publish', canPublish,/);
  assert.match(draftSource, /router\.post\('\/unpublish', canPublish,/);
  assert.match(mediaSource, /router\.get\('\/', canManage,/);
  assert.match(mediaSource, /router\.post\('\/upload', canManage,/);
});
