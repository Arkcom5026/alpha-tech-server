const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapRepairAsset,
  mapRepairJob,
} = require('../src/modules/repair/mappers/repairMapper');
const {
  repairJobDetailInclude,
  RepairJobDetailRepository,
} = require('../src/modules/repair/query/job-detail/repairJobDetailRepository');

test('detail projection reads technical model from intake snapshot without registered Device', () => {
  const job = mapRepairJob({
    id: 101,
    jobNo: 'RE-2-101',
    branchId: 2,
    customerId: 7,
    deviceId: null,
    deviceModel: 'Epson L3210',
    reportedSymptoms: 'ปริ้นไม่ออก',
    status: 'RECEIVED',
    estimatedCost: 0,
    depositPaid: 0,
    device: null,
    stockItem: null,
    deviceIntake: {
      id: 501,
      branchId: 2,
      assetDescription: 'Epson L3210',
      snapshot: {
        id: 601,
        brand: 'Epson',
        model: 'L3210',
        serialNumber: 'EP-001',
        imei: null,
        barcode: null,
      },
    },
    partsUsed: [],
    warrantyClaims: [],
  });

  assert.equal(job.repairAsset.sourceType, 'INTAKE_SNAPSHOT');
  assert.equal(job.repairAsset.displayName, 'Epson L3210');
  assert.equal(job.repairAsset.model, 'L3210');
  assert.equal(job.repairAsset.brand, 'Epson');
  assert.equal(job.repairAsset.serialNumber, 'EP-001');
});

test('intake snapshot wins over later registered Device master changes for historical job identity', () => {
  const asset = mapRepairAsset({
    deviceModel: 'เครื่องซักผ้าฝาหน้า',
    deviceIntake: {
      id: 11,
      assetDescription: 'Samsung เครื่องซักผ้าฝาหน้า',
      snapshot: {
        id: 12,
        brand: 'Samsung',
        model: 'WW90T504DTT',
        serialNumber: 'SN-AT-INTAKE',
        imei: null,
        barcode: 'BC-AT-INTAKE',
      },
    },
    device: {
      id: 77,
      brand: 'Samsung Updated',
      model: 'MODEL-CHANGED-LATER',
      category: 'OTHER',
      serialNumber: 'SN-MASTER-NEW',
      imei: null,
      barcode: 'BC-MASTER-NEW',
    },
    stockItem: null,
  });

  assert.equal(asset.displayName, 'Samsung เครื่องซักผ้าฝาหน้า');
  assert.equal(asset.model, 'WW90T504DTT');
  assert.equal(asset.brand, 'Samsung');
  assert.equal(asset.serialNumber, 'SN-AT-INTAKE');
  assert.equal(asset.barcode, 'BC-AT-INTAKE');
});

test('legacy repair without intake snapshot safely falls back to RepairJob and Device identity', () => {
  const asset = mapRepairAsset({
    deviceModel: 'iPhone 15 Pro',
    deviceIntake: null,
    device: {
      id: 88,
      brand: 'Apple',
      model: 'A3108',
      category: 'MOBILE_DEVICE',
      serialNumber: null,
      imei: 'IMEI-88',
      barcode: null,
    },
    stockItem: null,
  });

  assert.equal(asset.sourceType, 'CUSTOMER_DEVICE');
  assert.equal(asset.displayName, 'iPhone 15 Pro');
  assert.equal(asset.model, 'A3108');
  assert.equal(asset.brand, 'Apple');
  assert.equal(asset.imei, 'IMEI-88');
});

test('repair detail repository loads intake snapshot while preserving branch-scoped lookup', async () => {
  assert.deepEqual(repairJobDetailInclude.deviceIntake, {
    include: { snapshot: true },
  });

  let observedWhere = null;
  const fakeClient = {
    repairJob: {
      findFirst: async ({ where }) => {
        observedWhere = where;
        return null;
      },
    },
  };
  const repo = new RepairJobDetailRepository(fakeClient);
  const result = await repo.findById(9, 123);

  assert.equal(result, null);
  assert.deepEqual(observedWhere, { id: 123, branchId: 9 });
});
