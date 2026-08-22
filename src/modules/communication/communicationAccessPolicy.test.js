const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');
const { POSITION_CAPABILITIES } = require('../employee/authorization/employeePositionAuthority');

const ACCESS = POSITION_CAPABILITIES.COMMUNICATION_ACCESS;
const MANAGE = POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE;

test('legacy communication compatibility preserves operational access and elevated profile management', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'EMPLOYEE', employeeRole: 'MANAGER' }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('migrated positions require explicit communication capabilities and empty arrays stay authoritative', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 10, role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 11, role: 'EMPLOYEE', positionCapabilities: [ACCESS, MANAGE] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 12, role: 'EMPLOYEE', positionCapabilities: [MANAGE] }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});

test('platform admin keeps communication authority when employee context is present', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 13, role: 'ADMIN', positionCapabilities: [] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER', positionCapabilities: [ACCESS, MANAGE] }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
