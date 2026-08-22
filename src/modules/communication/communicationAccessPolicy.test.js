const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');

test('legacy employees preserve communication access while only owner and manager manage profiles', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'EMPLOYEE', employeeRole: 'CASHIER' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.equal(
    getCommunicationCapabilities({ employeeId: 10, role: 'EMPLOYEE', employeeRole: 'MANAGER' }).manageCommunicationProfiles,
    true,
  );
  assert.equal(
    getCommunicationCapabilities({ employeeId: 11, role: 'EMPLOYEE', employeeRole: 'OWNER' }).manageCommunicationProfiles,
    true,
  );
});

test('migrated positions require explicit communication capabilities', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 12,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 12,
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: ['communication.access'],
    }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 12,
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: ['communication.access', 'communication.profile.manage'],
    }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('platform admin still needs employee context for communication routes', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'ADMIN' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN', positionCapabilities: [] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
