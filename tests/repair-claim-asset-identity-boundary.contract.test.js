const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { mapClaimAsset, mapWarrantyClaim } = require('../src/modules/repair/mappers/repairMapper');

const detailRepoSource = fs.readFileSync(
  path.join(__dirname, '../src/modules/repair/claim/query/detail/getWarrantyClaimRepository.js'),
  'utf8'
);
const listRepoSource = fs.readFileSync(
  path.join(__dirname, '../src/modules/repair/claim/query/list/listWarrantyClaimsRepository.js'),
  'utf8'
);

const baseClaim = (overrides = {}) => ({
  id: 51,
  claimNo: 'CL-51',
  branchId: 2,
  repairJobId: 24,
  repairJob: {
    id: 24,
    jobNo: 'RE-24',
    branchId: 2,
    customerId: 10,
    customer: { id: 10, name: 'ลูกค้าทดสอบ' },
    deviceModel: 'Epson L3210',
    reportedSymptoms: 'พิมพ์ไม่ออก',
    deviceIntake: {
      id: 90,
      assetDescription: 'Epson L3210',
      snapshot: {
        id: 91,
        brand: 'Epson',
        model: 'L3210',
        serialNumber: 'SN-INTAKE',
        imei: null,
        barcode: 'BC-INTAKE',
      },
    },
  },
  stockItemId: null,
  stockItem: null,
  deviceId: null,
  device: null,
  supplier: null,
  status: 'SUBMITTED',
  reason: 'อยู่ในประกัน',
  serviceProvider: null,
  externalClaimRef: null,
  trackingNumber: null,
  resolution: null,
  resolutionNote: null,
  replacementStockItemId: null,
  replacementStockItem: null,
  creditAmount: null,
  openedAt: new Date('2026-08-14T06:00:00.000Z'),
  submittedAt: null,
  providerReceivedAt: null,
  resolvedAt: null,
  cancelledAt: null,
  events: [],
  createdAt: new Date('2026-08-14T06:00:00.000Z'),
  updatedAt: new Date('2026-08-14T06:00:00.000Z'),
  ...overrides,
});

test('repair-linked claim inherits intake snapshot identity as canonical claimAsset', () => {
  const asset = mapClaimAsset(baseClaim());
  assert.equal(asset.sourceType, 'INTAKE_SNAPSHOT');
  assert.equal(asset.displayName, 'Epson L3210');
  assert.equal(asset.model, 'L3210');
  assert.equal(asset.serialNumber, 'SN-INTAKE');
  assert.equal(asset.barcode, 'BC-INTAKE');
});

test('repair intake snapshot wins over later device or stock master identity changes', () => {
  const claim = baseClaim({
    stockItem: {
      id: 7,
      barcode: 'BC-MASTER',
      serialNumber: 'SN-MASTER',
      product: { name: 'Master Product', brand: { name: 'MasterBrand' }, productType: { name: 'Printer' } },
    },
    device: {
      id: 8,
      brand: 'ChangedBrand',
      model: 'ChangedModel',
      serialNumber: 'SN-DEVICE',
      barcode: 'BC-DEVICE',
    },
  });
  const asset = mapClaimAsset(claim);
  assert.equal(asset.displayName, 'Epson L3210');
  assert.equal(asset.brand, 'Epson');
  assert.equal(asset.model, 'L3210');
  assert.equal(asset.serialNumber, 'SN-INTAKE');
  assert.equal(asset.barcode, 'BC-INTAKE');
});

test('direct claim without repair job still uses stock or device authority safely', () => {
  const claim = baseClaim({
    repairJobId: null,
    repairJob: null,
    stockItemId: 7,
    stockItem: {
      id: 7,
      barcode: 'STOCK-BC',
      serialNumber: 'STOCK-SN',
      product: { name: 'Canon G2010', brand: { name: 'Canon' }, productType: { name: 'Printer' } },
    },
  });
  const mapped = mapWarrantyClaim(claim);
  assert.equal(mapped.claimAsset.sourceType, 'STOCK_ITEM');
  assert.equal(mapped.claimAsset.displayName, 'Canon G2010');
  assert.equal(mapped.claimAsset.serialNumber, 'STOCK-SN');
});

test('claim list and detail repositories load repair intake snapshot while staying branch scoped', () => {
  for (const source of [detailRepoSource, listRepoSource]) {
    assert.match(source, /deviceIntake\s*:\s*\{/);
    assert.match(source, /snapshot\s*:\s*true/);
    assert.match(source, /branchId:\s*Number\(branchId\)/);
  }
});
