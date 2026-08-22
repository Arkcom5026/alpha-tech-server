const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');
const {
  OPERATIONAL_POSITION_CAPABILITIES,
} = require('../employee/authorization/employeeOperationalPositionAuthority');

test('legacy technician can operate communication without managing branch profiles', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
});

test('legacy manager and platform admin preserve communication profile management', () => {
  assert.equal(getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'MANAGER' }).manageCommunicationProfiles, true);
  assert.equal(getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN' }).manageCommunicationProfiles, true);
});

test('migrated position capabilities are authoritative for communication', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE],
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

test('communication profile management requires both operate and profile-manage capabilities', () => {
  assert.equal(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      positionCapabilities: [OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE],
    }).manageCommunicationProfiles,
    false,
  );

  assert.equal(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      positionCapabilities: [
        OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE,
        OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
      ],
    }).manageCommunicationProfiles,
    true,
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(getCommunicationCapabilities({ role: 'CUSTOMER' }), { viewCommunication: false, manageCommunicationProfiles: false });
});
