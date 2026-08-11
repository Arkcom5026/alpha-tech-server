const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashToken,
  mapCustomerStatus,
  mapWorkflowCustomerStatus,
  mapPublicWorkflowEvent,
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

test('READY_FOR_DELIVERY customer copy stays correct when QC was intentionally skipped', () => {
  const status = mapWorkflowCustomerStatus('READY_FOR_DELIVERY', 'IN_PROGRESS');
  assert.deepEqual(status, {
    code: 'READY',
    label: 'พร้อมรับเครื่อง',
    description: 'งานเสร็จและพร้อมส่งมอบแล้ว กรุณายืนยันการรับเครื่องเมื่อมาถึงร้าน',
    stage: 4,
  });
  assert.doesNotMatch(status.description, /QC/);

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

test('public workflow events replace internal action codes with customer-friendly milestones', () => {
  const directStart = mapPublicWorkflowEvent({
    eventType: 'REPAIR_STATUS_CHANGED',
    title: 'งานซ่อม RE-9: START_REPAIR',
    description: null,
    occurredAt: new Date('2026-08-11T04:00:00Z'),
    metadata: { action: 'START_REPAIR', workflowTargetStatus: 'REPAIRING' },
  });
  assert.equal(directStart.type, 'IN_PROGRESS');
  assert.equal(directStart.title, 'เริ่มดำเนินการแล้ว');
  assert.doesNotMatch(directStart.title, /START_REPAIR/);

  const directComplete = mapPublicWorkflowEvent({
    eventType: 'REPAIR_STATUS_CHANGED',
    title: 'งานซ่อม RE-9: COMPLETE_REPAIR_DIRECT',
    description: 'ติดตั้งระบบและทดสอบใช้งานปกติ',
    occurredAt: new Date('2026-08-11T05:00:00Z'),
    metadata: { action: 'COMPLETE_REPAIR_DIRECT', workflowTargetStatus: 'READY_FOR_DELIVERY' },
  });
  assert.equal(directComplete.type, 'READY');
  assert.equal(directComplete.title, 'พร้อมรับเครื่อง');
  assert.equal(directComplete.description, 'ติดตั้งระบบและทดสอบใช้งานปกติ');
  assert.doesNotMatch(directComplete.title, /COMPLETE_REPAIR_DIRECT/);
});

test('public projection never exposes simplified-flow command names in passport timeline titles', () => {
  const job = publicJobFixture({
    device: {
      ...publicJobFixture().device,
      passportEvents: [
        {
          eventType: 'REPAIR_STATUS_CHANGED',
          title: 'งานซ่อม RE-9: START_REPAIR',
          description: null,
          occurredAt: new Date('2026-08-11T04:00:00Z'),
          metadata: { action: 'START_REPAIR', workflowTargetStatus: 'REPAIRING' },
        },
        {
          eventType: 'REPAIR_STATUS_CHANGED',
          title: 'งานซ่อม RE-9: COMPLETE_REPAIR_DIRECT',
          description: 'พร้อมใช้งาน',
          occurredAt: new Date('2026-08-11T05:00:00Z'),
          metadata: { action: 'COMPLETE_REPAIR_DIRECT', workflowTargetStatus: 'READY_FOR_DELIVERY' },
        },
      ],
    },
  });

  const projection = toPublicProjection(job, [], 'READY_FOR_DELIVERY');
  const titles = projection.repair.timeline.map((event) => event.title).join(' | ');
  assert.doesNotMatch(titles, /START_REPAIR|COMPLETE_REPAIR_DIRECT/);
  assert.match(titles, /เริ่มดำเนินการแล้ว/);
  assert.match(titles, /พร้อมรับเครื่อง/);
});
