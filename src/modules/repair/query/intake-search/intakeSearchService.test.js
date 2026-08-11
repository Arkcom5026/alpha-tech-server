const test = require('node:test');
const assert = require('node:assert/strict');
const { IntakeSearchService } = require('./intakeSearchService');

test('unified intake search returns grouped customers and ranked exact device match', async () => {
  const repository = {
    async search(branchId, query, limit) {
      assert.equal(branchId, 2);
      assert.equal(query, 'SN-001');
      assert.equal(limit, 10);
      return {
        devices: [
          {
            id: 1,
            barcode: 'BC-001',
            serialNumber: 'SN-001',
            tag: null,
            status: 'SOLD',
            product: {
              id: 10,
              name: 'Laser Printer 400',
              brand: { id: 3, name: 'Canon' },
              productType: { id: 4, name: 'Printer' },
            },
            saleItems: [{
              sale: {
                customerId: 7,
                soldAt: new Date('2026-01-01T00:00:00Z'),
                customer: {
                  id: 7,
                  name: 'สมชาย',
                  companyName: null,
                  user: { loginId: '0812345678', email: null },
                },
              },
            }],
            repairJobs: [],
            _count: { repairJobs: 0 },
          },
        ],
        customers: [{
          id: 7,
          name: 'สมชาย',
          companyName: null,
          taxId: null,
          type: 'INDIVIDUAL',
          addressDetail: null,
          user: { loginId: '0812345678', email: null },
        }],
      };
    },
  };

  const service = new IntakeSearchService(repository);
  const result = await service.execute({ branchId: 2 }, ' SN-001 ');

  assert.equal(result.query, 'SN-001');
  assert.equal(result.counts.total, 2);
  assert.equal(result.devices[0].exactIdentifierMatch, true);
  assert.equal(result.devices[0].latestCustomer.id, 7);
  assert.equal(result.devices[0].repairHistoryCount, 0);
  assert.equal(result.customers[0].phone, '0812345678');
});

test('unified intake search returns an empty result instead of throwing not found', async () => {
  const service = new IntakeSearchService({
    async search() {
      return { devices: [], customers: [] };
    },
  });

  const result = await service.execute({ branchId: 2 }, 'โรงพยาบาล');
  assert.deepEqual(result.counts, { devices: 0, customers: 0, total: 0 });
});

test('unified intake search finds a registered external device by store barcode', async () => {
  const service = new IntakeSearchService({
    async search() {
      return {
        devices: [],
        registeredDevices: [{
          id: 2,
          barcode: 'DEV-2-A1B2C3D4',
          serialNumber: null,
          imei: null,
          category: 'NOTEBOOK',
          brand: 'Acer',
          model: 'Aspire',
          status: 'IN_REPAIR',
          currentOwner: {
            id: 224,
            name: 'ทดลอง รับซ่อม',
            companyName: null,
            user: { loginId: '0811111111', email: null },
          },
          repairJobs: [{
            id: 2,
            jobNo: 'RE-2-20260727-S302CYM3241CC',
            status: 'RECEIVED',
            createdAt: new Date('2026-07-27T09:03:44Z'),
            customer: {
              id: 224,
              name: 'ทดลอง รับซ่อม',
              companyName: null,
              user: { loginId: '0811111111', email: null },
            },
          }],
          _count: { repairJobs: 3 },
        }],
        customers: [],
      };
    },
  });

  const result = await service.execute({ branchId: 2 }, 'DEV-2-A1B2C3D4');

  assert.equal(result.counts.devices, 1);
  assert.equal(result.devices[0].sourceType, 'REGISTERED_DEVICE');
  assert.equal(result.devices[0].exactIdentifierMatch, true);
  assert.equal(result.devices[0].barcode, 'DEV-2-A1B2C3D4');
  assert.equal(result.devices[0].latestCustomer.id, 224);
  assert.equal(result.devices[0].latestRepairJob.id, 2);
  assert.equal(result.devices[0].repairHistoryCount, 3);
});

test('customer-name intake search projects previously repaired registered devices with history metadata', async () => {
  const service = new IntakeSearchService({
    async search(branchId, query) {
      assert.equal(branchId, 2);
      assert.equal(query, 'ชัยวัฒน์');
      return {
        devices: [],
        registeredDevices: [{
          id: 77,
          barcode: 'DEV-2-CUSTOMER-HISTORY',
          serialNumber: 'SN-HISTORY',
          imei: null,
          category: 'NOTEBOOK',
          brand: 'Acer',
          model: 'Aspire',
          status: 'ACTIVE',
          currentOwner: {
            id: 256,
            name: 'ชัยวัฒน์ คำสอน',
            companyName: null,
            user: { loginId: '0862010888', email: null },
          },
          repairJobs: [{
            id: 17,
            jobNo: 'RE-2-20260811-HISTORY',
            status: 'COMPLETED',
            createdAt: new Date('2026-08-11T08:00:00Z'),
            customer: {
              id: 256,
              name: 'ชัยวัฒน์ คำสอน',
              companyName: null,
              user: { loginId: '0862010888', email: null },
            },
          }],
          _count: { repairJobs: 4 },
        }],
        customers: [{
          id: 256,
          name: 'ชัยวัฒน์ คำสอน',
          companyName: null,
          taxId: null,
          type: 'INDIVIDUAL',
          addressDetail: null,
          user: { loginId: '0862010888', email: null },
        }],
      };
    },
  });

  const result = await service.execute({ branchId: 2 }, 'ชัยวัฒน์');

  assert.equal(result.counts.devices, 1);
  assert.equal(result.counts.customers, 1);
  assert.equal(result.devices[0].latestCustomer.id, 256);
  assert.equal(result.devices[0].latestRepairJob.jobNo, 'RE-2-20260811-HISTORY');
  assert.equal(result.devices[0].repairHistoryCount, 4);
});
