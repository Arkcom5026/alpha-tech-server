const assert = require('assert');
const { RepairService } = require('../src/modules/repair/services/repairService');
const { ServiceAssetService } = require('../src/modules/repair/services/serviceAssetService');

async function main() {
  const state = {
    asset: null,
    repairJob: null,
  };

  const repo = {
    prisma: {},
    transaction(work) {
      return work(this);
    },
    async findCustomer(customerId) {
      return Number(customerId) === 41
        ? { id: 41, name: 'ลูกค้าทดสอบ' }
        : null;
    },
    async findStockItemByIdForIntake() {
      return null;
    },
    async findEmployee() {
      return null;
    },
    async findServiceAsset() {
      return null;
    },
    async findServiceAssetBySourceStockItem() {
      return null;
    },
    async createServiceAsset(data) {
      state.asset = {
        id: 501,
        ...data,
        images: [],
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
        updatedAt: new Date('2026-07-26T00:00:00.000Z'),
      };
      return state.asset;
    },
    async updateServiceAsset(id, data) {
      state.asset = { ...state.asset, id, ...data };
      return state.asset;
    },
    async createRepairJob(data) {
      state.repairJob = {
        id: 9001,
        ...data,
        customer: { id: 41, name: 'ลูกค้าทดสอบ' },
        stockItem: null,
        technician: null,
        partsUsed: [],
        warrantyClaims: [],
        createdAt: new Date('2026-07-26T00:00:00.000Z'),
        updatedAt: new Date('2026-07-26T00:00:00.000Z'),
      };
      return state.repairJob;
    },
  };

  const service = new RepairService(repo, new ServiceAssetService());
  const result = await service.createRepairJob(
    {
      branchId: 3,
      employeeId: 9,
      role: 'MANAGER',
    },
    {
      customerId: 41,
      deviceType: 'โน้ตบุ๊ก',
      brandName: 'Example',
      modelName: 'Model X',
      serialNumber: 'SN-TEST-001',
      accessories: ['อะแดปเตอร์'],
      physicalCondition: 'มีรอยใช้งานเล็กน้อย',
      deviceModel: 'Model X',
      reportedSymptoms: 'เปิดไม่ติด',
      depositPaid: 500,
      estimatedCost: 1500,
    }
  );

  assert.ok(state.asset, 'service asset must be created');
  assert.strictEqual(state.asset.customerId, 41);
  assert.strictEqual(state.asset.branchId, 3);
  assert.strictEqual(state.asset.status, 'IN_SERVICE');
  assert.strictEqual(state.asset.source, 'EXTERNAL_CUSTOMER');
  assert.strictEqual(state.asset.serialNumber, 'SN-TEST-001');

  assert.ok(state.repairJob, 'repair job must be created');
  assert.strictEqual(state.repairJob.serviceAssetId, state.asset.id);
  assert.strictEqual(result.serviceAssetId, state.asset.id);
  assert.strictEqual(result.serviceAsset.id, state.asset.id);
  assert.strictEqual(result.serviceAsset.assetNo, state.asset.assetNo);
  assert.strictEqual(result.status, 'RECEIVED');

  console.log('Repair Job Service Asset Integration: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
