const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  toPublicProjection,
  mapPublicWorkflowEvent,
} = require('../src/modules/repair/customer-access/repairTrackingAccessService');

const root = path.join(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

function baseJob(overrides = {}) {
  return {
    id: 24,
    jobNo: 'RE-2-20260814-SSKH1OTA2EDE1',
    branchId: 2,
    deviceId: null,
    deviceModel: 'Epson L3210',
    reportedSymptoms: 'ปริ้นไม่ออก',
    status: 'RECEIVED',
    estimatedCost: 0,
    depositPaid: 0,
    createdAt: new Date('2026-08-14T06:29:00.000Z'),
    updatedAt: new Date('2026-08-14T06:30:00.000Z'),
    customer: { name: 'ทดสอบ' },
    branch: { name: 'แอดวานซ์ เทค', phone: '0800000000', address: 'test' },
    stockItem: null,
    device: null,
    deviceIntake: {
      id: 50,
      referenceNo: 'RI-50',
      assetDescription: 'Epson L3210',
      receivedAt: new Date('2026-08-14T06:29:00.000Z'),
      snapshot: {
        id: 51,
        brand: 'Epson',
        model: 'L3210',
        serialNumber: 'SN-L3210',
        imei: null,
        barcode: null,
      },
      accessories: [],
    },
    warrantyClaims: [],
    delivery: null,
    ...overrides,
  };
}

test('paperless tracking exposes canonical repairAsset from intake snapshot without Device Passport', () => {
  const projection = toPublicProjection(
    baseJob(),
    [],
    'WAITING_DIAGNOSIS',
    [
      {
        eventType: 'REPAIR_ACCEPTED',
        action: 'ACCEPT_JOB',
        targetStatus: 'ACCEPTED',
        description: 'ช่างรับผิดชอบใบงานแล้ว',
        occurredAt: new Date('2026-08-14T06:30:00.000Z'),
      },
    ]
  );

  assert.equal(projection.contractVersion, 'repair-customer-tracking.v2');
  assert.deepEqual(projection.repair.repairAsset, {
    displayName: 'Epson L3210',
    model: 'L3210',
    brand: 'Epson',
    category: null,
    serialNumber: 'SN-L3210',
    imei: null,
    barcode: null,
  });
  assert.equal(projection.repair.device.displayName, 'Epson L3210');
  assert.equal(projection.repair.device.model, 'L3210');
  assert.equal(projection.repair.timeline.some((item) => item.title === 'ช่างรับงานแล้ว'), true);
});

test('paperless tracking keeps intake snapshot ahead of later registered Device master edits', () => {
  const job = baseJob({
    deviceId: 99,
    device: {
      id: 99,
      brand: 'Epson Master',
      model: 'MASTER-NEW',
      serialNumber: 'MASTER-SN',
      imei: null,
      barcode: null,
      category: 'PRINTER',
      passportEvents: [],
    },
  });

  const projection = toPublicProjection(job, [], 'REPAIRING', []);
  assert.equal(projection.repair.repairAsset.displayName, 'Epson L3210');
  assert.equal(projection.repair.repairAsset.model, 'L3210');
  assert.equal(projection.repair.repairAsset.serialNumber, 'SN-L3210');
});

test('public workflow copy accepts repair-owned event columns without passport metadata', () => {
  const mapped = mapPublicWorkflowEvent({
    action: 'WAIT_FOR_PARTS',
    targetStatus: 'WAITING_PARTS',
    occurredAt: new Date('2026-08-14T07:00:00.000Z'),
  });
  assert.equal(mapped.type, 'WAITING_PARTS');
  assert.equal(mapped.title, 'กำลังรออะไหล่');
});

test('tracking repository scopes repair-owned workflow authority by repair job and branch', () => {
  const source = read('src/modules/repair/customer-access/repairTrackingAccessRepository.js');
  assert.match(source, /FROM "RepairWorkflowEvent"/);
  assert.match(source, /"repairJobId" = \$\{Number\(repairJobId\)\}/);
  assert.match(source, /"branchId" = \$\{Number\(branchId\)\}/);
  assert.match(source, /"customerVisible" = true/);
  assert.match(source, /assetDescription: true/);
  assert.match(source, /snapshot:\s*\{[\s\S]*model: true/);
});
