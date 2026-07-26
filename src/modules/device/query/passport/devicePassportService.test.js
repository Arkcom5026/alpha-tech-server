const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DevicePassportService,
  toTimeline,
} = require('./devicePassportService');

test('orders mixed lifecycle events chronologically when event store is empty', () => {
  const timeline = toTimeline(
    [{ id: 1, intakeNo: 'DI-1', purpose: 'REPAIR', status: 'CONFIRMED', createdAt: new Date('2026-01-01') }],
    [{ id: 2, jobNo: 'RP-1', status: 'IN_PROGRESS', createdAt: new Date('2026-01-02') }],
    [{ id: 3, claimNo: 'CL-1', status: 'DRAFT', openedAt: new Date('2026-01-03') }],
    []
  );
  assert.deepEqual(timeline.map((event) => event.type), [
    'DEVICE_INTAKE',
    'REPAIR',
    'WARRANTY_CLAIM',
  ]);
});

test('prefers passport events when event store has data', () => {
  const timeline = toTimeline([], [], [], [{
    eventType: 'DEVICE_INTAKE_CREATED',
    sourceType: 'DEVICE_INTAKE',
    sourceId: 11,
    title: 'รับอุปกรณ์เข้าระบบ',
    description: 'เปิดไม่ติด',
    customerVisible: true,
    occurredAt: new Date('2026-01-01'),
    metadata: { intakeNo: 'DI-1' },
  }]);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].type, 'DEVICE_INTAKE_CREATED');
  assert.equal(timeline[0].referenceId, 11);
});

test('returns a branch-safe device passport', async () => {
  const repository = {
    getDevice: async (branchId, deviceId) => ({
      id: deviceId,
      branchId,
      model: 'ThinkPad T14',
      currentOwnerCustomerId: 7,
    }),
    getOwnershipHistory: async () => [{ customerId: 7 }],
    getIntakes: async () => [{
      id: 11,
      intakeNo: 'DI-4-11',
      purpose: 'REPAIR',
      status: 'CONFIRMED',
      createdAt: new Date('2026-01-01'),
    }],
    getRepairs: async () => [],
    getClaims: async () => [],
    getEvents: async () => [{
      id: 1,
      eventType: 'DEVICE_INTAKE_CREATED',
      sourceType: 'DEVICE_INTAKE',
      sourceId: 11,
      title: 'รับอุปกรณ์เข้าระบบ',
      description: null,
      customerVisible: true,
      metadata: null,
      occurredAt: new Date('2026-01-01'),
    }],
  };
  const service = new DevicePassportService(repository);
  const result = await service.execute({ branchId: 4 }, 51);

  assert.equal(result.contractVersion, 'device-passport.v2');
  assert.equal(result.device.id, 51);
  assert.equal(result.currentOwnerCustomerId, 7);
  assert.equal(result.lifecycle.timeline[0].type, 'DEVICE_INTAKE_CREATED');
});

test('rejects invalid and cross-branch device lookup', async () => {
  const service = new DevicePassportService({
    getDevice: async () => null,
  });
  await assert.rejects(
    () => service.execute({ branchId: 4 }, 'bad'),
    (error) => error.code === 'INVALID_DEVICE_ID'
  );
  await assert.rejects(
    () => service.execute({ branchId: 4 }, 99),
    (error) => error.code === 'DEVICE_NOT_FOUND'
  );
});
