const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');

const ACCESS = 'communication.access';
const MANAGE = 'communication.profile.manage';

test('legacy repair employee can view communication without managing branch profiles', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );
});

test('legacy branch manager and platform admin can manage communication profiles', () => {
  assert.equal(
    getCommunicationCapabilities({ employeeId: 8, role: 'EMPLOYEE', employeeRole: 'MANAGER' })
      .manageCommunicationProfiles,
    true,
  );
  assert.equal(
    getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN' }).manageCommunicationProfiles,
    true,
  );
});

test('migrated positions require explicit communication capabilities', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'MANAGER',
      positionCapabilities: [],
    }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );

  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'TECHNICIAN',
      positionCapabilities: [ACCESS, MANAGE],
    }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
