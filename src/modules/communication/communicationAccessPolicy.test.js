const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMMUNICATION_CAPABILITY,
  getCommunicationCapabilities,
} = require('./communicationAccessPolicy');

test('legacy repair employee can view communication without managing branch profiles', () => {
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
