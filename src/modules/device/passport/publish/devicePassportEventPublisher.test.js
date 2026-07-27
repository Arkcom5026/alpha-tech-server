const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDevicePassportEvent,
  publishDevicePassportEvent,
} = require('./devicePassportEventPublisher');

test('normalizes a repair event and infers employee actor type', () => {
  const event = normalizeDevicePassportEvent({
    deviceId: '12',
    branchId: '3',
    eventType: 'REPAIR_CREATED',
    sourceType: 'REPAIR_JOB',
    sourceId: '41',
    eventKey: 'repair-job:41:created',
    title: 'เปิดใบงานซ่อม',
    actorEmployeeId: '7',
    customerVisible: true,
    metadata: { repairJobId: 41 },
    occurredAt: '2026-07-27T00:00:00.000Z',
  });

  assert.equal(event.deviceId, 12);
  assert.equal(event.branchId, 3);
  assert.equal(event.actorType, 'EMPLOYEE');
  assert.equal(event.actorEmployeeId, 7);
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.customerVisible, true);
});

test('rejects invalid actor combinations', () => {
  assert.throws(
    () => normalizeDevicePassportEvent({
      deviceId: 12,
      branchId: 3,
      eventType: 'REPAIR_CREATED',
      eventKey: 'repair-job:41:created',
      title: 'เปิดใบงานซ่อม',
      actorEmployeeId: 7,
      actorCustomerId: 8,
    }),
    /both employee and customer actors/
  );
});

test('publishes once and returns the existing event on idempotent retry', async () => {
  const existing = { id: 91, deviceId: 12, eventKey: 'repair-job:41:created' };
  let creates = 0;
  const prisma = {
    devicePassportEvent: {
      create() {
        creates += 1;
        if (creates === 1) return Promise.resolve(existing);
        return Promise.reject(Object.assign(new Error('duplicate'), { code: 'P2002' }));
      },
      findFirst(args) {
        assert.deepEqual(args.where, {
          deviceId: 12,
          eventKey: 'repair-job:41:created',
        });
        return Promise.resolve(existing);
      },
    },
  };

  const input = {
    deviceId: 12,
    branchId: 3,
    eventType: 'REPAIR_CREATED',
    sourceType: 'REPAIR_JOB',
    sourceId: '41',
    eventKey: 'repair-job:41:created',
    title: 'เปิดใบงานซ่อม',
  };

  assert.equal((await publishDevicePassportEvent(prisma, input)).id, 91);
  assert.equal((await publishDevicePassportEvent(prisma, input)).id, 91);
});
