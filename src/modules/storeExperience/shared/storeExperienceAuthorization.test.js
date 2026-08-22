'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STORE_EXPERIENCE_CAPABILITIES,
  allowStoreExperienceCapabilities,
} = require('./storeExperienceAuthorization');

const invoke = (middleware, user) => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  let nextCalled = false;
  middleware({ user }, response, () => { nextCalled = true; });
  return { response, nextCalled };
};

test('legacy employees preserve historical store experience access', () => {
  const middleware = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITIES.READ,
    STORE_EXPERIENCE_CAPABILITIES.MANAGE,
    STORE_EXPERIENCE_CAPABILITIES.PUBLISH,
  );
  const result = invoke(middleware, {
    employeeId: 7,
    profileType: 'employee',
    employeeRole: 'TECHNICIAN',
  });
  assert.equal(result.nextCalled, true);
});

test('migrated positions split read, manage and publish authority', () => {
  const canRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITIES.READ);
  const canPublish = allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITIES.READ,
    STORE_EXPERIENCE_CAPABILITIES.MANAGE,
    STORE_EXPERIENCE_CAPABILITIES.PUBLISH,
  );
  const user = {
    employeeId: 7,
    profileType: 'employee',
    employeeRole: 'OWNER',
    positionCapabilities: [STORE_EXPERIENCE_CAPABILITIES.READ],
  };
  assert.equal(invoke(canRead, user).nextCalled, true);
  const denied = invoke(canPublish, user);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
});

test('migrated empty capability array fails closed while platform admin retains authority', () => {
  const canRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITIES.READ);
  const denied = invoke(canRead, {
    employeeId: 7,
    profileType: 'employee',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
  assert.equal(invoke(canRead, { role: 'ADMIN', positionCapabilities: [] }).nextCalled, true);
});
