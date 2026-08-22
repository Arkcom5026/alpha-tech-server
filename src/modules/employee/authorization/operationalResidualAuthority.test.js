const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveResidualCapability,
} = require('./operationalResidualAuthority');
const { getCommunicationCapabilities } = require('../../communication/communicationAccessPolicy');
const { buildProductTracePermissions } = require('../../product/trace/policies/productTracePolicy');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('migrated positions require explicit operational residual capabilities', () => {
  const migratedEmpty = {
    id: 1,
    employeeId: 10,
    employeeRole: 'OWNER',
    positionCapabilities: [],
  };
  const migratedAllowed = {
    ...migratedEmpty,
    positionCapabilities: [OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_VIEW],
  };

  assert.equal(resolveResidualCapability(
    migratedEmpty,
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_VIEW,
    { legacyRoles: ['OWNER'] },
  ), false);
  assert.equal(resolveResidualCapability(
    migratedAllowed,
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_VIEW,
    { legacyRoles: ['OWNER'] },
  ), true);
});

test('communication preserves legacy employee behavior while positions migrate', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'EMPLOYEE', employeeRole: 'OWNER' }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 9,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});

test('product trace preserves legacy read and financial visibility but positions become authoritative', () => {
  const legacyCustomer = buildProductTracePermissions({ actor: { id: 7, role: 'CUSTOMER' }, employeeProfile: null });
  assert.equal(legacyCustomer.canViewTrace, true);
  assert.equal(legacyCustomer.canViewFinancials, false);

  const legacyOwner = buildProductTracePermissions({
    actor: { id: 8, role: 'EMPLOYEE', employeeId: 3 },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(legacyOwner.canViewTrace, true);
  assert.equal(legacyOwner.canViewFinancials, true);

  const migratedEmpty = buildProductTracePermissions({
    actor: { id: 9, role: 'EMPLOYEE', employeeId: 4, employeeRole: 'OWNER', positionCapabilities: [] },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(migratedEmpty.canViewTrace, false);
  assert.equal(migratedEmpty.canViewFinancials, false);

  const migratedExplicit = buildProductTracePermissions({
    actor: {
      id: 10,
      role: 'EMPLOYEE',
      employeeId: 5,
      positionCapabilities: [
        OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_READ,
        OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
      ],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  });
  assert.equal(migratedExplicit.canViewTrace, true);
  assert.equal(migratedExplicit.canViewFinancials, true);
});

test('store experience routes split read, manage, publish and media authority', () => {
  const draftRoutes = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
  const mediaRoutes = read('src/modules/storeExperience/media/storefrontMediaRoutes.js');
  const positionService = read('src/modules/position/runtime/positionRuntimeService.js');

  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.READ/);
  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.MANAGE/);
  assert.match(draftRoutes, /STORE_EXPERIENCE_CAPABILITY\.PUBLISH/);
  assert.match(mediaRoutes, /STORE_EXPERIENCE_CAPABILITY\.MEDIA/);
  assert.doesNotMatch(draftRoutes, /employeeRole|roleOf/);
  assert.doesNotMatch(mediaRoutes, /employeeRole|roleOf/);
  assert.match(positionService, /OPERATIONAL_RESIDUAL_CAPABILITIES/);
});

test('platform admins retain operational residual authority', () => {
  assert.equal(resolveResidualCapability(
    { id: 1, role: 'ADMIN', positionCapabilities: [] },
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
  ), true);
  assert.equal(resolveResidualCapability(
    { id: 1, role: 'SUPERADMIN', positionCapabilities: [] },
    OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
  ), true);
});
