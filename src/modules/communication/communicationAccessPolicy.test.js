const test = require('node:test');
const assert = require('node:assert/strict');
const { getCommunicationCapabilities } = require('./communicationAccessPolicy');

test('legacy employee compatibility preserves communication usage while profile management stays elevated', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capability = getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole,
    });

    assert.equal(capability.viewCommunication, true, `${employeeRole} should retain communication usage`);
    assert.equal(
      capability.manageCommunicationProfiles,
      ['OWNER', 'MANAGER'].includes(employeeRole),
      `${employeeRole} profile management compatibility mismatch`,
    );
  }
});

test('migrated position capabilities are authoritative including an explicit empty array', () => {
  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: ['communication.use'],
    }),
    { viewCommunication: true, manageCommunicationProfiles: false },
  );

  assert.deepEqual(
    getCommunicationCapabilities({
      employeeId: 8,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: ['communication.use', 'communication.profile.manage'],
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

test('platform administrators retain communication capabilities only with employee context', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ employeeId: 9, role: 'ADMIN', positionCapabilities: [] }),
    { viewCommunication: true, manageCommunicationProfiles: true },
  );
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'ADMIN', positionCapabilities: [] }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});

test('non-employee cannot access communication authority', () => {
  assert.deepEqual(
    getCommunicationCapabilities({ role: 'CUSTOMER' }),
    { viewCommunication: false, manageCommunicationProfiles: false },
  );
});
