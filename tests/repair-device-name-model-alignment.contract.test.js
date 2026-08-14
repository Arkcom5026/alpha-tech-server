const test = require('node:test');
const assert = require('node:assert/strict');
const { mapRepairAsset, mapRepairJob } = require('../src/modules/repair/mappers/repairMapper');

test('registered repair asset keeps RepairJob device name as primary display name', () => {
  const asset = mapRepairAsset({
    deviceModel: 'เครื่องซักผ้า Samsung ฝาหน้า',
    device: {
      id: 77,
      brand: 'Samsung',
      model: 'WW90T504DTT',
      category: 'OTHER',
      serialNumber: 'SN-77',
    },
  });

  assert.equal(asset.displayName, 'เครื่องซักผ้า Samsung ฝาหน้า');
  assert.equal(asset.model, 'WW90T504DTT');
  assert.equal(asset.brand, 'Samsung');
});

test('simple descriptive repair uses deviceModel as device name without inventing a technical model', () => {
  const asset = mapRepairAsset({
    deviceModel: 'Canon G2010',
    device: null,
    stockItem: null,
  });

  assert.equal(asset.displayName, 'Canon G2010');
  assert.equal(asset.model, null);
});

test('repair job projection exposes separate display name and registered model', () => {
  const job = mapRepairJob({
    id: 12,
    jobNo: 'RE-1-12',
    branchId: 1,
    customerId: 3,
    deviceId: 77,
    deviceModel: 'iPhone 15 Pro',
    reportedSymptoms: 'ชาร์จไม่เข้า',
    status: 'RECEIVED',
    estimatedCost: 0,
    depositPaid: 0,
    device: {
      id: 77,
      brand: 'Apple',
      model: 'A3108',
      category: 'MOBILE_DEVICE',
      serialNumber: null,
      imei: null,
      barcode: null,
      status: 'IN_REPAIR',
    },
    partsUsed: [],
    warrantyClaims: [],
  });

  assert.equal(job.repairAsset.displayName, 'iPhone 15 Pro');
  assert.equal(job.repairAsset.model, 'A3108');
  assert.equal(job.deviceModel, 'iPhone 15 Pro');
});
