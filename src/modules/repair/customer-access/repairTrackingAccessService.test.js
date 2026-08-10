const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashToken,
  mapCustomerStatus,
  mapWorkflowCustomerStatus,
  toPublicProjection,
} = require('./repairTrackingAccessService');

test('tracking token is stored as a deterministic sha256 hash', () => {
  const token = 'a'.repeat(43);
  assert.equal(hashToken(token).length, 64);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

function publicJobFixture(overrides = {}) {
  return {
    id: 9,
    jobNo: 'RE-2-20260727-TEST',
    branchId: 2,
    deviceId: 2,
    deviceModel: 'Acer Aspire',
    reportedSymptoms: 'เปิดไม่ติด',
    status: 'IN_PROGRESS',
    estimatedCost: 1500,
    depositPaid: 300,
    createdAt: new Date('2026-07-27T09:00:00Z'),
    updatedAt: new Date('2026-07-27T10:00:00Z'),
    customer: { name: 'สมชาย ใจดี', companyName: null },
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
    delivery: null,
    ...overrides,
  };
}

test('public tracking projects an external registered device with only the pickup name default', () => {
  const projection = toPublicProjection(publicJobFixture());

  assert.equal(projection.repair.device.barcode, 'DEV-2-ABC');
  assert.equal(projection.repair.device.displayName, 'Acer Aspire');
  assert.equal(projection.repair.status.code, 'IN_PROGRESS');
  assert.equal(projection.repair.estimate.estimatedBalance, 1200);
  assert.equal(projection.repair.accessories[0].type, 'CHARGER');
  assert.deepEqual(projection.repair.pickupDefaults, { receiverName: 'สมชาย ใจดี' });
  assert.equal(Object.hasOwn(projection, 'customer'), false);
  assert.equal(Object.hasOwn(projection.repair, 'customer'), false);
});

test('pickup name default falls back to customer company name without exposing contact details', () => {
  const projection = toPublicProjection(publicJobFixture({
    customer: { name: null, companyName: 'บริษัท ทดสอบ จำกัด' },
  }));

  assert.deepEqual(projection.repair.pickupDefaults, { receiverName: 'บริษัท ทดสอบ จำกัด' });
});

test('completed repair maps to customer-ready status', () => {
  assert.deepEqual(mapCustomerStatus('COMPLETED'), {
    code: 'READY',
    label: 'ดำเนินการเสร็จแล้ว',
    description: 'กรุณาติดต่อร้านเพื่อรับอุปกรณ์',
    stage: 4,
  });
});

test('READY_FOR_DELIVERY workflow overrides legacy in-progress projection for customer pickup', () => {
  const status = mapWorkflowCustomerStatus('READY_FOR_DELIVERY', 'IN_PROGRESS');
  assert.deepEqual(status, {
    code: 'READY',
    label: 'พร้อมรับเครื่อง',
    description: 'งานซ่อมและการตรวจ QC เสร็จแล้ว กรุณายืนยันการรับเครื่องเพื่อดำเนินการส่งมอบ',
    stage: 4,
  });

  const projection = toPublicProjection(publicJobFixture(), [], 'READY_FOR_DELIVERY');
  assert.equal(projection.repair.status.code, 'READY');
  assert.equal(projection.repair.status.stage, 4);
  assert.equal(projection.repair.status.label, 'พร้อมรับเครื่อง');
});

test('workflow authority keeps waiting-parts and cancellation customer projections aligned', () => {
  assert.equal(mapWorkflowCustomerStatus('WAITING_PARTS', 'IN_PROGRESS').code, 'WAITING_PARTS');
  assert.equal(mapWorkflowCustomerStatus('CANCELLED', 'IN_PROGRESS').code, 'CANCELLED');
  assert.equal(mapWorkflowCustomerStatus('DIAGNOSING', 'RECEIVED').code, 'IN_PROGRESS');
});
