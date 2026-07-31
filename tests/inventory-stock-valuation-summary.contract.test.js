'use strict';

const assert = require('assert');
const {
  GetStockDashboardOverviewRepository,
  GetStockDashboardOverviewService,
  GetStockDashboardOverviewController,
} = require('../src/modules/inventory/dashboard/query/overview/getStockDashboardOverviewSlice');

const makePrisma = () => {
  const calls = [];
  const prisma = {
    stockItem: {
      groupBy: async (args) => {
        calls.push(['stockItem.groupBy', args]);
        return [
          { status: 'IN_STOCK', _count: { _all: 3 } },
          { status: 'CLAIMED', _count: { _all: 1 } },
        ];
      },
      aggregate: async (args) => {
        calls.push(['stockItem.aggregate', args]);
        return { _count: { _all: 3 }, _sum: { costPrice: 4500 } };
      },
      count: async (args) => {
        calls.push(['stockItem.count', args]);
        if (args.where.status === 'IN_STOCK') return 1;
        return 2;
      },
    },
    stockBalance: {
      aggregate: async (args) => {
        calls.push(['stockBalance.aggregate', args]);
        return {
          _count: { _all: 2 },
          _sum: { quantity: 10, reserved: 3 },
        };
      },
    },
    simpleLot: {
      aggregate: async (args) => {
        calls.push(['simpleLot.aggregate', args]);
        return { _count: { _all: 2 }, _sum: { qtyRemaining: 9 } };
      },
      findMany: async (args) => {
        calls.push(['simpleLot.findMany', args]);
        return [
          { qtyRemaining: 5, unitCost: 100 },
          { qtyRemaining: 4, unitCost: null },
        ];
      },
    },
  };
  return { prisma, calls };
};

(async () => {
  const branchId = 27;
  const now = new Date('2026-07-31T12:00:00.000Z');
  const { prisma, calls } = makePrisma();
  const repository = new GetStockDashboardOverviewRepository(prisma);
  const service = new GetStockDashboardOverviewService(repository);
  const result = await service.execute(branchId, now);

  assert.strictEqual(result.branchId, branchId);
  assert.strictEqual(result.scope.branchId, branchId);
  assert.strictEqual(result.scope.calculatedAt, now.toISOString());

  assert.strictEqual(result.structured.inStock, 3);
  assert.strictEqual(result.structured.claimed, 1);
  assert.strictEqual(result.structured.costValue, 4500);
  assert.strictEqual(result.structured.missingCostCount, 1);

  assert.strictEqual(result.simple.qtyOnHand, 10);
  assert.strictEqual(result.simple.qtyReserved, 3);
  assert.strictEqual(result.simple.netAvailable, 7);

  assert.strictEqual(result.lot.qtyRemaining, 9);
  assert.strictEqual(result.lot.costValue, 500);
  assert.strictEqual(result.lot.missingCostLotCount, 1);
  assert.strictEqual(result.lot.missingCostQuantity, 4);

  assert.deepStrictEqual(result.valuation, {
    structuredCostValue: 4500,
    simpleCostValue: 500,
    totalCostValue: 5000,
  });
  assert.deepStrictEqual(result.dataQuality, {
    missingCostItems: 1,
    missingCostLots: 1,
    missingCostQuantity: 4,
    hasIncompleteValuation: true,
    quantityReconciliationDifference: 1,
  });

  for (const [name, args] of calls) {
    assert.strictEqual(args.where.branchId, branchId, `${name} must be scoped to authenticated branchId`);
  }

  const controller = new GetStockDashboardOverviewController({
    execute: async () => {
      throw new Error('must not execute without branch scope');
    },
  });
  let statusCode = null;
  let payload = null;
  await controller.handle(
    { user: {} },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        payload = value;
        return value;
      },
    }
  );

  assert.strictEqual(statusCode, 403);
  assert.strictEqual(payload.error, 'INVENTORY_BRANCH_SCOPE_REQUIRED');

  console.log('inventory stock valuation summary contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
