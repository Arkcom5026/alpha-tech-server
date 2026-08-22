'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const invoke = (middleware, user) => new Promise((resolve) => {
  const req = { user };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; resolve({ nextCalled: false, res: this }); },
  };
  middleware(req, res, () => resolve({ nextCalled: true, res }));
});

test('legacy employees preserve historical store experience access', async () => {
  const guard = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );

  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = await invoke(guard, { role: 'EMPLOYEE', employeeRole });
    assert.equal(result.nextCalled, true, employeeRole);
  }
});

test('migrated positions require explicit store experience capabilities', async () => {
  const read = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
  const publish = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );

  assert.equal((await invoke(read, {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  })).res.statusCode, 403);

  assert.equal((await invoke(read, {
    role: 'EMPLOYEE',
    employeeRole: 'TECHNICIAN',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ],
  })).nextCalled, true);

  assert.equal((await invoke(publish, {
    role: 'EMPLOYEE',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.MANAGE],
  })).res.statusCode, 403);
});

test('platform admins retain store experience capability authority', async () => {
  const guard = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  );
  assert.equal((await invoke(guard, { role: 'ADMIN', positionCapabilities: [] })).nextCalled, true);
  assert.equal((await invoke(guard, { role: 'SUPERADMIN', positionCapabilities: [] })).nextCalled, true);
});

test('draft and media routes split read, manage and publish authority', () => {
  const draft = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const media = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draft, /router\.get\('\/draft', canRead,/);
  assert.match(draft, /router\.put\('\/draft', canManage,/);
  assert.match(draft, /router\.post\('\/publish', canPublish,/);
  assert.match(draft, /router\.post\('\/unpublish', canPublish,/);
  assert.match(media, /router\.get\('\/', canRead,/);
  assert.match(media, /router\.post\('\/upload', canManage,/);
  assert.doesNotMatch(draft, /employeeRole|v2Role|OWNER|MANAGER|CASHIER|TECHNICIAN/);
  assert.doesNotMatch(media, /employeeRole|v2Role|OWNER|MANAGER|CASHIER|TECHNICIAN/);
});
