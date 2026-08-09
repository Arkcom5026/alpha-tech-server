const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GetCustomersWithPendingSalesRepository,
} = require('./getCustomersWithPendingSalesRepository');
const {
  GetCustomersWithPendingSalesService,
} = require('./getCustomersWithPendingSalesService');

test('repository preserves branch scope, pending sale rules, keyword search and ordering', async () => {
  let receivedQuery;
  const prisma = {
    sale: {
      findMany: async (query) => {
        receivedQuery = query;
        return [];
      },
    },
  };

  const repository = new GetCustomersWithPendingSalesRepository(prisma);
  await repository.findPendingSales({ branchId: 7, keyword: 'acme' });

  assert.deepEqual(receivedQuery.where, {
    branchId: 7,
    isCredit: true,
    status: { not: 'CANCELLED' },
    statusPayment: { in: ['PARTIALLY_PAID', 'PAID'] },
    customerId: { not: null },
    customer: {
      OR: [
        { name: { contains: 'acme', mode: 'insensitive' } },
        { phone: { contains: 'acme', mode: 'insensitive' } },
        { companyName: { contains: 'acme', mode: 'insensitive' } },
      ],
    },
  });
  assert.deepEqual(receivedQuery.include, { customer: true });
  assert.deepEqual(receivedQuery.orderBy, { soldAt: 'asc' });
});

test('service rejects missing branch authority before repository access', async () => {
  let called = false;
  const service = new GetCustomersWithPendingSalesService({
    findPendingSales: async () => {
      called = true;
      return [];
    },
  });

  await assert.rejects(() => service.execute({ branchId: undefined }), (error) => {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, 'unauthorized');
    return true;
  });
  assert.equal(called, false);
});

test('service preserves grouped customer and sale response projection', async () => {
  const soldAt = new Date('2026-07-31T00:00:00.000Z');
  const service = new GetCustomersWithPendingSalesService({
    findPendingSales: async (input) => {
      assert.deepEqual(input, { branchId: 3, keyword: 'shop' });
      return [
        {
          id: 11,
          code: 'S-11',
          soldAt,
          customerId: 4,
          totalBeforeDiscount: 100,
          totalDiscount: 10,
          totalAfterDiscount: 90,
          customer: {
            id: 4,
            name: 'Alpha Shop',
            phone: '0800000000',
            email: 'alpha@example.com',
            address: 'Bangkok',
            customerType: 'BUSINESS',
            companyName: 'Alpha Co.',
          },
        },
        {
          id: 12,
          code: 'S-12',
          soldAt,
          customerId: 4,
          totalBeforeDiscount: 200,
          totalDiscount: 0,
          totalAfterDiscount: 200,
          customer: {
            id: 4,
            name: 'Alpha Shop',
            phone: '0800000000',
            email: 'alpha@example.com',
            address: 'Bangkok',
            customerType: 'BUSINESS',
            companyName: 'Alpha Co.',
          },
        },
      ];
    },
  });

  const result = await service.execute({ branchId: '3', keyword: ' shop ' });

  assert.deepEqual(result, [
    {
      id: 4,
      name: 'Alpha Shop',
      phone: '0800000000',
      email: 'alpha@example.com',
      address: 'Bangkok',
      customerType: 'BUSINESS',
      companyName: 'Alpha Co.',
      sales: [
        {
          id: 11,
          code: 'S-11',
          soldAt,
          totalBeforeDiscount: 100,
          totalDiscount: 10,
          totalAfterDiscount: 90,
        },
        {
          id: 12,
          code: 'S-12',
          soldAt,
          totalBeforeDiscount: 200,
          totalDiscount: 0,
          totalAfterDiscount: 200,
        },
      ],
    },
  ]);
});
