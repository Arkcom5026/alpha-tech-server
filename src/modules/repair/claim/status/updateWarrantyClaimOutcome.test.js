const test = require('node:test');
const assert = require('node:assert/strict');

const { UpdateWarrantyClaimStatusService } = require('./updateWarrantyClaimStatusService');
const { resolveWarrantyClaimOutcome } = require('./warrantyClaimOutcomePolicy');

function claimFixture(overrides = {}) {
  return {
    id: 31,
    claimNo: 'WC-31',
    branchId: 4,
    stockItemId: 12,
    stockItem: null,
    deviceId: 55,
    device: { id: 55, status: 'IN_WARRANTY_CLAIM' },
    supplier: null,
    repairJobId: 18,
    repairJob: null,
    repairLinkState: 'LINKED_VERIFIED',
    status: 'REPLACEMENT_PENDING',
    reason: 'เสียในประกัน',
    serviceProvider: null,
    externalClaimRef: null,
    trackingNumber: null,
    resolution: null,
    resolutionNote: null,
    replacementStockItemId: null,
    replacementStockItem: null,
    creditAmount: null,
    openedAt: new Date('2026-08-01T00:00:00Z'),
    submittedAt: null,
    providerReceivedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    events: [],
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

test('resolution policy maps customer-retained and retired-device outcomes', () => {
  assert.deepEqual(resolveWarrantyClaimOutcome('REPAIRED'), {
    resolution: 'REPAIRED',
    deviceStatus: 'ACTIVE',
    passportEventType: 'WARRANTY_CLAIM_RESOLVED',
    consumeReplacementStockItem: false,
  });
  assert.deepEqual(resolveWarrantyClaimOutcome('REPLACED'), {
    resolution: 'REPLACED',
    deviceStatus: 'RETIRED',
    passportEventType: 'WARRANTY_REPLACED',
    consumeReplacementStockItem: true,
  });
  assert.equal(resolveWarrantyClaimOutcome('CREDITED').passportEventType, 'WARRANTY_CREDITED');
});

test('REPLACED resolution consumes selected stock and synchronizes device/passport atomically', async () => {
  const calls = [];
  const repo = {
    transaction(work) { return work(this); },
    findById() { return claimFixture(); },
    findReplacementStockItem(id) {
      assert.equal(id, 90);
      return { id: 90, branchId: 4, status: 'IN_STOCK', productId: 7 };
    },
    consumeReplacementStockItem(payload) {
      calls.push(['consume', payload]);
      return { count: 1 };
    },
    updateDeviceStatus(deviceId, status) {
      calls.push(['device', { deviceId, status }]);
      return { id: deviceId, status };
    },
    publishPassportEvent(event) {
      calls.push(['passport', event]);
      return event;
    },
    updateWithEvent(id, data, event) {
      calls.push(['claim', { id, data, event }]);
      return claimFixture({
        status: data.status,
        resolution: data.resolution,
        replacementStockItemId: data.replacementStockItemId,
        replacementStockItem: { id: 90, status: 'SOLD', product: { id: 7, name: 'Replacement' } },
        device: { id: 55, status: 'RETIRED' },
      });
    },
    createCompletionCommand(data) {
      calls.push(['completion', data]);
      return data;
    },
  };

  const service = new UpdateWarrantyClaimStatusService(repo);
  const result = await service.execute(
    { branchId: 4, employeeId: 8 },
    31,
    {
      status: 'RESOLVED',
      expectedStatus: 'REPLACEMENT_PENDING',
      resolution: 'REPLACED',
      replacementStockItemId: 90,
      resolutionNote: 'เปลี่ยนสินค้าใหม่ให้ลูกค้า',
    }
  );

  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.replacementStockItem.id, 90);
  assert.equal(result.device.status, 'RETIRED');
  assert.equal(calls[0][0], 'consume');
  assert.equal(calls[1][1].status, 'RETIRED');
  assert.equal(calls[2][1].eventType, 'WARRANTY_REPLACED');
  assert.equal(calls[3][1].event.metadata.outcome.replacementConsumed, true);
  assert.match(calls[4][1].commandKey, /^warranty-claim:31:resolved$/);
  assert.match(calls[4][1].requestHash, /^[a-f0-9]{64}$/);
});

test('replacement consumption conflict aborts before device and claim writes', async () => {
  let deviceWrites = 0;
  let claimWrites = 0;
  const service = new UpdateWarrantyClaimStatusService({
    transaction(work) {
      return work({
        findById() { return claimFixture(); },
        findReplacementStockItem() { return { id: 90, branchId: 4, status: 'IN_STOCK' }; },
        consumeReplacementStockItem() { return { count: 0 }; },
        updateDeviceStatus() { deviceWrites += 1; },
        updateWithEvent() { claimWrites += 1; },
      });
    },
  });

  await assert.rejects(
    () => service.execute(
      { branchId: 4, employeeId: 8 },
      31,
      {
        status: 'RESOLVED',
        expectedStatus: 'REPLACEMENT_PENDING',
        resolution: 'REPLACED',
        replacementStockItemId: 90,
      }
    ),
    (error) => error.code === 'CONFLICT'
  );
  assert.equal(deviceWrites, 0);
  assert.equal(claimWrites, 0);
});
