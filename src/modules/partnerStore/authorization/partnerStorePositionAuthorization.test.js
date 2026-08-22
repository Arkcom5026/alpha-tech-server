'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PARTNER_STORE_CAPABILITY,
  requirePartnerStoreEmployeeContext,
  allowPartnerStoreCapabilities,
} = require('./partnerStorePositionAuthorization');

const invoke = (middleware, user, employee = null) => new Promise((resolve) => {
  const req = { user, employee };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; resolve({ nextCalled: false, res: this }); },
  };
  middleware(req, res, () => resolve({ nextCalled: true, res }));
});

test('legacy employee roles preserve historical partner-store settings access', async () => {
  const manage = allowPartnerStoreCapabilities(
    PARTNER_STORE_CAPABILITY.READ,
    PARTNER_STORE_CAPABILITY.MANAGE,
  );

  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = await invoke(manage, { role: 'EMPLOYEE', employeeRole });
    assert.equal(result.nextCalled, true, employeeRole);
  }
});

test('migrated positions use store-experience read/manage capabilities authoritatively', async () => {
  const read = allowPartnerStoreCapabilities(PARTNER_STORE_CAPABILITY.READ);
  const manage = allowPartnerStoreCapabilities(
    PARTNER_STORE_CAPABILITY.READ,
    PARTNER_STORE_CAPABILITY.MANAGE,
  );

  assert.equal((await invoke(read, {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  })).res.statusCode, 403);

  assert.equal((await invoke(read, {
    role: 'EMPLOYEE',
    positionCapabilities: ['store-experience.read'],
  })).nextCalled, true);

  assert.equal((await invoke(manage, {
    role: 'EMPLOYEE',
    positionCapabilities: ['store-experience.read'],
  })).res.statusCode, 403);

  assert.equal((await invoke(manage, {
    role: 'EMPLOYEE',
    positionCapabilities: ['store-experience.read', 'store-experience.manage'],
  })).nextCalled, true);
});

test('partner-store employee-context compatibility remains separate from capability authority', async () => {
  assert.equal((await invoke(requirePartnerStoreEmployeeContext, {
    role: 'EMPLOYEE',
    profileType: 'employee',
  })).nextCalled, true);
  assert.equal((await invoke(requirePartnerStoreEmployeeContext, { role: 'ADMIN' })).nextCalled, true);
  assert.equal((await invoke(requirePartnerStoreEmployeeContext, { role: 'CUSTOMER' })).res.statusCode, 403);
});

test('routes reuse store-experience authority and leave onboarding/readiness ownership untouched', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/partnerStoreCapabilityRoutes.js'), 'utf8');

  assert.match(source, /router\.use\('\/onboarding', onboardingRoutes\)/);
  assert.match(source, /router\.use\('\/readiness', operationalReadinessRoutes\)/);
  assert.match(source, /router\.get\('\/capability', canReadStoreExperience,/);
  assert.match(source, /router\.put\('\/capability', canManageStoreExperience,/);
  assert.match(source, /router\.get\('\/online-products\/visibility-audit', canReadStoreExperience,/);
  assert.match(source, /router\.patch\('\/online-products\/:productId\/price', canManageStoreExperience,/);
  assert.doesNotMatch(source, /employeeRole|v2Role|OWNER|MANAGER|CASHIER|TECHNICIAN/);
});
