const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DevicePassportEventService,
  normalizeEvent,
} = require('./devicePassportEventService');

test('normalizes supported passport events', () => {
  const event = normalizeEvent({
    deviceId: 51,
    branchId: 4,
    eventType: 'device_intake_created',
    sourceType: 'device_intake',
    sourceId: 101,
    title: ' รับอุปกรณ์ ',
    customerVisible: true,
    metadata: { intakeNo: 'DI-1' },
  });

  assert.equal(event.eventType, 'DEVICE_INTAKE_CREATED');
  assert.equal(event.sourceType, 'DEVICE_INTAKE');
  assert.equal(event.title, 'รับอุปกรณ์');
  assert.equal(event.customerVisible, true);
  assert.ok(event.occurredAt instanceof Date);
});

test('rejects unsupported event types', () => {
  assert.throws(
    () => normalizeEvent({ eventType: 'UNKNOWN' }),
    (error) => error.code === 'INVALID_DEVICE_PASSPORT_EVENT'
  );
});

test('creates an idempotent event through repository authority', async () => {
  const calls = [];
  const service = new DevicePassportEventService({
    createEvent: async (data) => {
      calls.push(data);
      return { id: 1, ...data };
    },
  });

  const result = await service.create({
    deviceId: 51,
    branchId: 4,
    eventType: 'DEVICE_CREATED',
    sourceType: 'DEVICE',
    sourceId: 51,
  });

  assert.equal(result.id, 1);
  assert.equal(calls[0].deviceId, 51);
  assert.equal(calls[0].eventType, 'DEVICE_CREATED');
});
