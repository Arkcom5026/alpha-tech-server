const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { toPublicProjection } = require('../src/modules/repair/customer-access/repairTrackingAccessService');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function baseJob(overrides = {}) {
  return {
    id: 24,
    jobNo: 'RE-2-TEST',
    branchId: 2,
    deviceId: 99,
    deviceModel: 'Legacy Device Name',
    reportedSymptoms: 'เปิดไม่ติด',
    status: 'RECEIVED',
    estimatedCost: 0,
    depositPaid: 0,
    createdAt: new Date('2026-08-14T01:00:00.000Z'),
    updatedAt: new Date('2026-08-14T01:00:00.000Z'),
    customer: { name: 'ทดสอบ' },
    branch: { name: 'สาขาทดสอบ', phone: null, address: null },
    stockItem: null,
    device: {
      id: 99,
      brand: 'Master Brand',
      model: 'MASTER-MODEL',
      category: 'PRINTER',
      serialNumber: 'MASTER-SN',
      imei: null,
      barcode: 'MASTER-BC',
      passportEvents: [],
    },
    deviceIntake: {
      id: 501,
      referenceNo: 'INTAKE-501',
      assetDescription: 'Epson L3210',
      receivedAt: new Date('2026-08-14T01:00:00.000Z'),
      snapshot: {
        id: 601,
        brand: 'Epson',
        model: 'L3210',
        serialNumber: 'SN-INTAKE',
        imei: null,
        barcode: 'BC-INTAKE',
      },
      accessories: [],
    },
    warrantyClaims: [],
    delivery: null,
    ...overrides,
  };
}

test('customer tracking exposes canonical repairAsset with intake snapshot historical precedence', () => {
  const projection = toPublicProjection(baseJob(), [], 'WAITING_DIAGNOSIS');

  assert.equal(projection.contractVersion, 'repair-customer-tracking.v2');
  assert.equal(projection.repair.repairAsset.displayName, 'Epson L3210');
  assert.equal(projection.repair.repairAsset.model, 'L3210');
  assert.equal(projection.repair.repairAsset.brand, 'Epson');
  assert.equal(projection.repair.repairAsset.serialNumber, 'SN-INTAKE');
  assert.equal(projection.repair.repairAsset.barcode, 'BC-INTAKE');
  assert.deepEqual(projection.repair.device, projection.repair.repairAsset);
});

test('customer tracking supports no registered Device without inventing model from legacy device name', () => {
  const job = baseJob({
    deviceId: null,
    device: null,
    deviceModel: 'Canon G2010',
    deviceIntake: {
      id: 502,
      referenceNo: 'INTAKE-502',
      assetDescription: 'Canon G2010',
      receivedAt: new Date('2026-08-14T01:00:00.000Z'),
      snapshot: { id: 602, brand: 'Canon', model: null, serialNumber: null, imei: null, barcode: null },
      accessories: [],
    },
  });

  const projection = toPublicProjection(job, [], 'ACCEPTED');
  assert.equal(projection.repair.repairAsset.displayName, 'Canon G2010');
  assert.equal(projection.repair.repairAsset.model, null);
  assert.equal(projection.repair.status.code, 'RECEIVED');
});

test('public tracking repository selects intake identity and repair-owned workflow authority before passport fallback', () => {
  const source = read('src/modules/repair/customer-access/repairTrackingAccessRepository.js');

  assert.match(source, /assetDescription: true/);
  assert.match(source, /snapshot:[\s\S]*id: true[\s\S]*model: true/);
  assert.match(source, /FROM "RepairWorkflowEvent"/);
  assert.match(source, /sourceType: 'REPAIR_WORKFLOW_EVENT'/);
  assert.match(source, /DEVICE_PASSPORT_EVENT/);
});

test('staff tracking-link issuance remains branch scoped', () => {
  const source = read('src/modules/repair/customer-access/repairTrackingAccessRepository.js');
  assert.match(source, /where: \{ id: Number\(repairJobId\), branchId: Number\(branchId\) \}/);
});
