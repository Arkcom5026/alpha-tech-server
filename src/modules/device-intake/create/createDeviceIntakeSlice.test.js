const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CreateDeviceIntakeService,
  normalizePayload,
  buildDeviceFingerprint,
} = require('./createDeviceIntakeService');

test('normalizes a repair intake contract', () => {
  const payload = normalizePayload({
    customerId: '7',
    stockItemId: '11',
    purpose: 'repair',
    reportedSymptoms: ' เปิดไม่ติด ',
    snapshot: { model: 'ThinkPad T14' },
    accessories: [{ type: 'Adapter', quantity: 1 }],
    consent: { allowTracking: true, agreedTerms: true, termsVersion: 'v1' },
  });

  assert.equal(payload.customerId, 7);
  assert.equal(payload.stockItemId, 11);
  assert.equal(payload.purpose, 'REPAIR');
  assert.equal(payload.reportedSymptoms, 'เปิดไม่ติด');
  assert.equal(payload.snapshot.model, 'ThinkPad T14');
  assert.equal(payload.accessories[0].quantity, 1);
  assert.equal(payload.consent.agreedTerms, true);
  assert.ok(payload.consent.agreedAt instanceof Date);
});

test('builds stable fingerprints from authoritative identity', () => {
  const first = buildDeviceFingerprint({ model: 'T14', serialNumber: ' SN-11 ', brand: 'Lenovo' }, null);
  const second = buildDeviceFingerprint({ model: 't14', serialNumber: 'sn-11', brand: 'lenovo' }, null);
  assert.equal(first, second);
  assert.equal(buildDeviceFingerprint({}, 11), buildDeviceFingerprint({}, 11));
});

test('rejects unsupported purpose and missing device model', () => {
  assert.throws(
    () => normalizePayload({ customerId: 7, purpose: 'UNKNOWN', snapshot: { model: 'X' } }),
    (error) => error.code === 'INVALID_DEVICE_INTAKE_PURPOSE'
  );
  assert.throws(
    () => normalizePayload({ customerId: 7, purpose: 'REPAIR', snapshot: {} }),
    (error) => error.code === 'INVALID_DEVICE_INTAKE_INPUT'
  );
});

test('resolves device and creates passport events in one transaction', async () => {
  const calls = [];
  const txRepo = {
    findCustomerById: async (id) => ({ id }),
    findStockItem: async () => ({
      id: 11,
      barcode: 'BC-11',
      serialNumber: 'SN-11',
      product: {
        name: 'ThinkPad',
        brand: { name: 'Lenovo' },
        productType: { name: 'Notebook' },
      },
    }),
    findDevice: async (identity) => {
      calls.push(['findDevice', identity]);
      return null;
    },
    createDevice: async (data) => {
      calls.push(['device', data]);
      return { id: 51, createdAt: new Date('2026-01-01'), ...data };
    },
    updateDeviceIdentity: async () => {
      throw new Error('must not update a new device');
    },
    ensureOwnership: async (deviceId, customerId, employeeId) => {
      calls.push(['ownership', deviceId, customerId, employeeId]);
      return { id: 61 };
    },
    createPassportEvent: async (data) => {
      calls.push(['passportEvent', data]);
      return { id: calls.length, ...data };
    },
    createIntake: async (data) => {
      calls.push(['intake', data]);
      return { id: 101, createdAt: new Date('2026-01-02'), ...data };
    },
    createSnapshot: async (id, data) => ({ id: 201, deviceIntakeId: id, ...data }),
    createCondition: async (id, data) => ({ id: 301, deviceIntakeId: id, ...data }),
    createAccessories: async (_id, data) => data,
    createConsent: async (id, data) => ({ id: 401, deviceIntakeId: id, ...data }),
    createAudit: async (id, data) => {
      calls.push(['audit', id, data]);
      return { id: 501 };
    },
  };
  const repository = {
    transaction(work) {
      calls.push(['transaction']);
      return work(txRepo);
    },
  };
  const service = new CreateDeviceIntakeService(repository);

  const result = await service.execute(
    { branchId: 4, employeeId: 9 },
    {
      customerId: 7,
      stockItemId: 11,
      purpose: 'REPAIR',
      reportedSymptoms: 'No power',
      snapshot: { model: 'ThinkPad' },
      condition: { scratch: true },
      accessories: [{ type: 'Adapter' }],
      consent: { allowTracking: true },
    },
    { ipAddress: '127.0.0.1', userAgent: 'test' }
  );

  assert.equal(result.contractVersion, 'device-intake.v3');
  assert.equal(result.device.id, 51);
  assert.equal(result.intake.deviceId, 51);
  assert.equal(result.intake.status, 'AWAITING_CUSTOMER_CONFIRMATION');
  assert.equal(result.snapshot.brand, 'Lenovo');
  assert.equal(result.snapshot.serialNumber, 'SN-11');
  assert.equal(calls[0][0], 'transaction');
  assert.ok(calls.some(([name]) => name === 'ownership'));
  assert.equal(calls.filter(([name]) => name === 'passportEvent').length, 2);
  assert.ok(calls.some(([name]) => name === 'audit'));
});
