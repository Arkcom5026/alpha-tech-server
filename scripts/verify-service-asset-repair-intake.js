const assert = require('assert');
const {
  ServiceAssetService,
} = require('../src/modules/repair/services/serviceAssetService');

function createRepository() {
  const state = {
    assets: [],
  };

  return {
    state,
    async findServiceAsset(branchId, id) {
      return (
        state.assets.find(
          (asset) =>
            Number(asset.branchId) === Number(branchId) &&
            Number(asset.id) === Number(id)
        ) || null
      );
    },
    async findServiceAssetBySourceStockItem(stockItemId) {
      return (
        state.assets.find(
          (asset) => Number(asset.sourceStockItemId) === Number(stockItemId)
        ) || null
      );
    },
    async createServiceAsset(data) {
      const asset = {
        id: state.assets.length + 1,
        ...data,
      };
      state.assets.push(asset);
      return asset;
    },
    async updateServiceAsset(id, data) {
      const index = state.assets.findIndex(
        (asset) => Number(asset.id) === Number(id)
      );
      state.assets[index] = { ...state.assets[index], ...data };
      return state.assets[index];
    },
  };
}

const actor = {
  branchId: 3,
  employeeId: 11,
  role: 'MANAGER',
};

const main = async () => {
  const service = new ServiceAssetService();
  const repo = createRepository();

  const stockItem = {
    id: 91,
    branchId: 3,
    productId: 41,
    barcode: 'BC-91',
    serialNumber: 'SN-91',
    soldAt: new Date('2026-07-01T00:00:00.000Z'),
    expiredAt: new Date('2027-07-01T00:00:00.000Z'),
    product: {
      id: 41,
      name: 'Notebook Model A',
      brandId: 5,
      brand: { id: 5, name: 'Alpha' },
      productTypeId: 7,
      productType: { id: 7, name: 'Notebook' },
    },
  };

  const soldAsset = await service.resolveForRepairIntake(
    repo,
    actor,
    {
      customerId: 21,
      stockItemId: 91,
      deviceModel: 'Notebook Model A',
    },
    stockItem
  );

  assert.strictEqual(soldAsset.source, 'SOLD_BY_BRANCH');
  assert.strictEqual(soldAsset.status, 'IN_SERVICE');
  assert.strictEqual(soldAsset.sourceStockItemId, 91);
  assert.strictEqual(soldAsset.customerId, 21);
  assert.strictEqual(soldAsset.productId, 41);
  assert.ok(soldAsset.assetNo.startsWith('SA-3-'));

  const replayedAsset = await service.resolveForRepairIntake(
    repo,
    actor,
    {
      customerId: 21,
      stockItemId: 91,
      deviceModel: 'Notebook Model A',
    },
    stockItem
  );

  assert.strictEqual(replayedAsset.id, soldAsset.id);
  assert.strictEqual(repo.state.assets.length, 1);

  const externalAsset = await service.resolveForRepairIntake(repo, actor, {
    customerId: 22,
    deviceType: 'Printer',
    deviceModel: 'Laser 2000',
    brandName: 'Example Brand',
    serialNumber: 'EXT-001',
    accessories: ['สายไฟ', 'สาย USB'],
    physicalCondition: 'มีรอยด้านซ้าย',
  });

  assert.strictEqual(externalAsset.source, 'EXTERNAL_CUSTOMER');
  assert.strictEqual(externalAsset.status, 'IN_SERVICE');
  assert.strictEqual(externalAsset.customerId, 22);
  assert.strictEqual(externalAsset.modelName, 'Laser 2000');
  assert.deepStrictEqual(externalAsset.accessories, ['สายไฟ', 'สาย USB']);
  assert.strictEqual(repo.state.assets.length, 2);

  await assert.rejects(
    () =>
      service.resolveForRepairIntake(repo, actor, {
        customerId: 999,
        serviceAssetId: soldAsset.id,
      }),
    (error) => error.code === 'REPAIR_SERVICE_ASSET_CUSTOMER_MISMATCH'
  );

  repo.state.assets.push({
    id: 99,
    branchId: 3,
    customerId: 30,
    status: 'ARCHIVED',
  });

  await assert.rejects(
    () =>
      service.resolveForRepairIntake(repo, actor, {
        customerId: 30,
        serviceAssetId: 99,
      }),
    (error) => error.code === 'REPAIR_SERVICE_ASSET_ARCHIVED'
  );

  console.log('Service Asset Repair Intake: PASS');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
