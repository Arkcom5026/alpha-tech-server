const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');
const { POSITION_CAPABILITIES } = require('../employee/authorization/employeePositionAuthority');

test('repair employee keeps legacy communication access without profile management', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
});

test('legacy manager and platform admin keep communication profile management', () => {
  assert.equal(getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'MANAGER' }).manageCommunicationProfiles, true);
  assert.equal(getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN' }).manageCommunicationProfiles, true);
});

test('migrated positions require explicit communication capabilities', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'MANAGER',
      positionCapabilities: [POSITION_CAPABILITIES.COMMUNICATION_USE],
    }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );

  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'TECHNICIAN',
      positionCapabilities: [
        POSITION_CAPABILITIES.COMMUNICATION_USE,
        POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
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

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(getCommunicationCapabilities({ role: 'CUSTOMER' }), { viewCommunication: false, manageCommunicationProfiles: false });
});
