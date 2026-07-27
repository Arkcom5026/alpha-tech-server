const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashToken,
  mapCustomerStatus,
  toPublicProjection,
} = require('./repairTrackingAccessService');

test('tracking token is stored as a deterministic sha256 hash', () => {
  const token = 'a'.repeat(43);
  assert.equal(hashToken(token).length, 64);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

test('public tracking projects an external registered device without exposing customer data', () => {
  const projection = toPublicProjection({
    jobNo: 'RE-2-20260727-TEST',
    deviceModel: 'Acer Aspire',
    reportedSymptoms: 'เปิดไม่ติด',
    status: 'IN_PROGRESS',
    estimatedCost: 1500,
    depositPaid: 300,
    createdAt: new Date('2026-07-27T09:00:00Z'),
    updatedAt: new Date('2026-07-27T10:00:00Z'),
    branch: { name: 'Alpha Tech', phone: '0812345678', address: 'Bangkok' },
    stockItem: null,
    device: {
      id: 2,
      barcode: 'DEV-2-ABC',
      serialNumber: null,
      imei: null,
      brand: 'Acer',
      model: 'Aspire',
      category: 'NOTEBOOK',
      passportEvents: [],
    },
    deviceIntake: {
      referenceNo: 'EXT-2-001',
      receivedAt: new Date('2026-07-27T09:00:00Z'),
      snapshot: null,
      accessories: [{ accessoryType: 'CHARGER', quantity: 1, remark: null }],
    },
    warrantyClaims: [],
  });

  assert.equal(projection.repair.device.barcode, 'DEV-2-ABC');
  assert.equal(projection.repair.device.displayName, 'Acer Aspire');
  assert.equal(projection.repair.status.code, 'IN_PROGRESS');
  assert.equal(projection.repair.estimate.estimatedBalance, 1200);
  assert.equal(projection.repair.accessories[0].type, 'CHARGER');
  assert.equal(Object.hasOwn(projection, 'customer'), false);
});

test('completed repair maps to customer-ready status', () => {
  assert.deepEqual(mapCustomerStatus('COMPLETED'), {
    code: 'READY',
    label: 'ดำเนินการเสร็จแล้ว',
    description: 'กรุณาติดต่อร้านเพื่อรับอุปกรณ์',
    stage: 4,
  });
});
