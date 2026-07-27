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
