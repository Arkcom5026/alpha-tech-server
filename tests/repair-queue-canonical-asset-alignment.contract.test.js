const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ListRepairJobsService } = require('../src/modules/repair/query/list-jobs/listRepairJobsService');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function baseJob(overrides = {}) {
  return {
    id: 41,
    jobNo: 'RE-2-41',
    branchId: 2,
    customerId: 7,
    deviceModel: 'Epson L3210',
    reportedSymptoms: 'พิมพ์ไม่ออก',
    status: 'RECEIVED',
    estimatedCost: 0,
    depositPaid: 0,
    customer: { id: 7, name: 'ทดสอบ' },
    stockItem: null,
    device: null,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    subcontracts: [],
    delivery: null,
    ...overrides,
  };
}

function serviceFor(jobs, expectedBranchId = 2) {
  return new ListRepairJobsService({
    async findMany(branchId) {
      assert.equal(branchId, expectedBranchId);
      return jobs;
    },
  });
}

test('queue projection uses intake snapshot model without registered Device', async () => {
  const service = serviceFor([
    baseJob({
      deviceIntake: {
        assetDescription: 'Epson L3210',
        snapshot: { model: 'L3210', brand: 'Epson', serialNumber: 'SN-INTAKE' },
      },
    }),
  ]);

  const result = await service.execute({ branchId: 2 }, {});
  assert.equal(result.items[0].repairAsset.displayName, 'Epson L3210');
  assert.equal(result.items[0].repairAsset.model, 'L3210');
  assert.equal(result.items[0].repairAsset.brand, 'Epson');
  assert.equal(result.items[0].repairAsset.serialNumber, 'SN-INTAKE');
});

test('queue historical identity keeps intake snapshot ahead of later Device master edits', async () => {
  const service = serviceFor([
    baseJob({
      deviceId: 99,
      device: {
        id: 99,
        brand: 'EPSON-NEW',
        model: 'L9999',
        category: 'PRINTER',
        serialNumber: 'SN-MASTER',
        imei: null,
        barcode: 'DEV-99',
        status: 'IN_REPAIR',
      },
      deviceIntake: {
        assetDescription: 'Epson L3210',
        snapshot: {
          brand: 'Epson',
          model: 'L3210',
          serialNumber: 'SN-INTAKE',
          imei: null,
          barcode: null,
        },
      },
    }),
  ]);

  const asset = (await service.execute({ branchId: 2 }, {})).items[0].repairAsset;
  assert.equal(asset.displayName, 'Epson L3210');
  assert.equal(asset.model, 'L3210');
  assert.equal(asset.brand, 'Epson');
  assert.equal(asset.serialNumber, 'SN-INTAKE');
});

test('queue legacy jobs still resolve identity in BE mapper', async () => {
  const service = serviceFor([
    baseJob({
      deviceId: 88,
      device: {
        id: 88,
        brand: 'Canon',
        model: 'G2010',
        category: 'PRINTER',
        serialNumber: 'LEGACY-SN',
        imei: null,
        barcode: null,
        status: 'IN_REPAIR',
      },
      deviceIntake: null,
      deviceModel: 'Canon G2010',
    }),
  ]);

  const asset = (await service.execute({ branchId: 2 }, {})).items[0].repairAsset;
  assert.equal(asset.displayName, 'Canon G2010');
  assert.equal(asset.model, 'G2010');
  assert.equal(asset.serialNumber, 'LEGACY-SN');
});

test('queue repository loads intake snapshot and remains branch scoped', () => {
  const source = read('src/modules/repair/query/list-jobs/listRepairJobsRepository.js');
  assert.match(source, /deviceIntake:\s*\{[\s\S]*snapshot: true/);
  assert.match(source, /branchId: Number\(branchId\)/);
  assert.match(source, /repairJob\.findMany/);
});
