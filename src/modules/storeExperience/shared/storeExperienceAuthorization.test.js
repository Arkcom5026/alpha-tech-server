const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const runGuard = (guard, user) => new Promise((resolve) => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; resolve({ next: false, statusCode: this.statusCode, payload }); },
  };
  guard({ user }, response, () => resolve({ next: true, statusCode: 200, payload: null }));
});

test('legacy employee roles preserve historical store experience access', async () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = await runGuard(
      allowStoreExperienceCapabilities(
        STORE_EXPERIENCE_CAPABILITY.READ,
        STORE_EXPERIENCE_CAPABILITY.MANAGE,
        STORE_EXPERIENCE_CAPABILITY.PUBLISH,
      ),
      { role: 'EMPLOYEE', employeeRole },
    );
    assert.equal(result.next, true, employeeRole);
  }
});

test('migrated positions split store experience read, manage and publish authority', async () => {
  const readOnly = await runGuard(
    allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ),
    { role: 'EMPLOYEE', positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ] },
  );
  assert.equal(readOnly.next, true);

  const publishDenied = await runGuard(
    allowStoreExperienceCapabilities(
      STORE_EXPERIENCE_CAPABILITY.READ,
      STORE_EXPERIENCE_CAPABILITY.MANAGE,
      STORE_EXPERIENCE_CAPABILITY.PUBLISH,
    ),
    { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [STORE_EXPERIENCE_CAPABILITY.READ, STORE_EXPERIENCE_CAPABILITY.MANAGE] },
  );
  assert.equal(publishDenied.next, false);
  assert.equal(publishDenied.statusCode, 403);

  const emptyDenied = await runGuard(
    allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ),
    { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] },
  );
  assert.equal(emptyDenied.next, false);
});

test('platform admins retain store experience authority', async () => {
  const result = await runGuard(
    allowStoreExperienceCapabilities(
      STORE_EXPERIENCE_CAPABILITY.READ,
      STORE_EXPERIENCE_CAPABILITY.MANAGE,
      STORE_EXPERIENCE_CAPABILITY.PUBLISH,
    ),
    { role: 'ADMIN', positionCapabilities: [] },
  );
  assert.equal(result.next, true);
});

test('store experience routes no longer own hardcoded employee-role authority', () => {
  const draftSource = fs.readFileSync(path.join(__dirname, '../draft/storeExperienceDraftRoutes.js'), 'utf8');
  const mediaSource = fs.readFileSync(path.join(__dirname, '../media/storefrontMediaRoutes.js'), 'utf8');

  assert.match(draftSource, /allowRead/);
  assert.match(draftSource, /allowManage/);
  assert.match(draftSource, /allowPublish/);
  assert.match(mediaSource, /allowRead/);
  assert.match(mediaSource, /allowManage/);

  for (const source of [draftSource, mediaSource]) {
    assert.doesNotMatch(source, /OWNER|MANAGER|CASHIER|TECHNICIAN/);
    assert.doesNotMatch(source, /allowEmployeeContext/);
  }
});
