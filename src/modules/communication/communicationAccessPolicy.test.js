const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');

test('legacy repair employee keeps communication read and operation access without profile management', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, profileType: 'employee', role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, operateCommunication: true, manageCommunicationProfiles: false },
  );
});

test('legacy manager and platform admin retain communication profile management', () => {
  assert.equal(
    getCommunicationCapabilities({ employeeId: 8, profileType: 'employee', role: 'EMPLOYEE', employeeRole: 'MANAGER' }).manageCommunicationProfiles,
    true,
  );
  assert.equal(getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN' }).manageCommunicationProfiles, true);
});

test('migrated positions require explicit communication capabilities and empty array is authoritative', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      profileType: 'employee',
      employeeRole: 'OWNER',
      positionCapabilities: ['communication.read'],
    }),
    { viewCommunication: true, operateCommunication: false, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      profileType: 'employee',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, operateCommunication: false, manageCommunicationProfiles: false },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, operateCommunication: false, manageCommunicationProfiles: false },
  );
});
