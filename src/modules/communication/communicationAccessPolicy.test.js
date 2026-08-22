const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMMUNICATION_CAPABILITY,
  getCommunicationCapabilities,
} = require('./communicationAccessPolicy');

test('legacy employees preserve historical communication access while positions migrate', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'EMPLOYEE', employeeRole: 'CASHIER' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 10, role: 'EMPLOYEE', employeeRole: 'MANAGER' }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('migrated positions require explicit communication capabilities', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [COMMUNICATION_CAPABILITY.READ],
    }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [
        COMMUNICATION_CAPABILITY.READ,
        COMMUNICATION_CAPABILITY.PROFILE_MANAGE,
      ],
    }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});

test('platform admins retain communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'ADMIN', positionCapabilities: [] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'SUPERADMIN', positionCapabilities: [] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('non-employee legacy users do not receive communication compatibility authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
