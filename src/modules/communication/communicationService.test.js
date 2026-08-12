const test = require('node:test');
const assert = require('node:assert/strict');
const { CommunicationService } = require('./communicationService');

test('customer contact channel lookup is branch and customer isolated', async () => {
  let channelWhere;
  const service = new CommunicationService({
    customerProfile: { findFirst: ({ where }) => Promise.resolve(where.branchId === 3 ? { id: 8 } : null) },
    customerContactChannel: { findMany: ({ where }) => { channelWhere = where; return Promise.resolve([]); } },
  });
  await service.listCustomerChannels(3, 8);
  assert.deepEqual(channelWhere, { branchId: 3, customerId: 8, active: true });
});

test('repair preference rejects a contact channel from another customer', async () => {
  const service = new CommunicationService({
    repairJob: { findFirst: () => Promise.resolve({ id: 41, customerId: 8 }) },
    customerContactChannel: { findFirst: () => Promise.resolve(null) },
  });
  await assert.rejects(
    () => service.savePreference(3, 41, { channelType: 'LINE', contactChannelId: 99 }),
    (error) => error.statusCode === 409
  );
});

test('repair preference remains optional and provider-neutral', async () => {
  let written;
  const service = new CommunicationService({
    repairJob: { findFirst: () => Promise.resolve({ id: 41, customerId: 8 }) },
    repairCommunicationPreference: { upsert: (args) => { written = args; return Promise.resolve(args.create); } },
  });
  await service.savePreference(3, 41, {
    channelType: 'OTHER',
    destinationSnapshot: 'contact at front desk',
    consentGranted: false,
  });
  assert.equal(written.create.repairJobId, 41);
  assert.equal(written.create.contactChannelId, null);
  assert.equal(written.create.profileId, null);
  assert.equal(written.create.consentGranted, false);
  assert.equal(Object.hasOwn(written.create, 'provider'), false);
});
