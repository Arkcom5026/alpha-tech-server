const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
} = require('../employee/authorization/residualBusinessPositionAuthority');

test('legacy communication access remains available to ordinary employees without profile-management authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
});

test('legacy manager and platform admin can manage communication profiles', () => {
  assert.equal(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'MANAGER' }).manageCommunicationProfiles,
    true,
  );
  assert.equal(getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN' }).manageCommunicationProfiles, true);
});

test('migrated positions require explicit communication capabilities and empty arrays remain authoritative', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 10,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_ACCESS],
    }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 11,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
