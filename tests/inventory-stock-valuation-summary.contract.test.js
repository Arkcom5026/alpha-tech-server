'use strict';

const assert = require('assert');
const {
  GetStockDashboardOverviewRepository,
  GetStockDashboardOverviewService,
  GetStockDashboardOverviewController,
  buildTrackedSimpleProductWhere,
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
      findMany: async (args) => {
        calls.push(['stockBalance.findMany', args]);
        return [
          { quantity: 6, reserved: 1, avgCost: 100, lastReceivedCost: 120 },
          { quantity: 4, reserved: 2, avgCost: null, lastReceivedCost: 80 },
        ];
      },
    },
    simpleLot: {
      aggregate: async (args) => {
        calls.push(['simpleLot.aggregate', args]);
        return { _count: { _all: 2 }, _sum: { qtyRemaining: 9999 } };
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

  assert.deepStrictEqual(buildTrackedSimpleProductWhere(branchId), {
    mode: 'SIMPLE',
    inventoryBehavior: 'TRACKED',
    active: true,
    productType: { branchId },
  });

  assert.strictEqual(result.branchId, branchId);
  assert.strictEqual(result.scope.branchId, branchId);
  assert.strictEqual(result.scope.calculatedAt, now.toISOString());

  assert.strictEqual(result.structured.inStock, 3);
  assert.strictEqual(result.structured.claimed, 1);
  assert.strictEqual(result.structured.costValue, 4500);
  assert.strictEqual(result.structured.missingCostCount, 1);

  assert.strictEqual(result.simple.productCount, 2);
  assert.strictEqual(result.simple.qtyOnHand, 10);
  assert.strictEqual(result.simple.qtyReserved, 3);
  assert.strictEqual(result.simple.netAvailable, 7);
  assert.strictEqual(result.simple.costValue, 920);
  assert.strictEqual(result.simple.missingCostProductCount, 0);
  assert.strictEqual(result.simple.missingCostQuantity, 0);

  assert.strictEqual(result.lot.qtyRemaining, 9999);
  assert.strictEqual(result.lot.activeLotCount, 2);

  assert.deepStrictEqual(result.valuation, {
    structuredCostValue: 4500,
    simpleCostValue: 920,
    totalCostValue: 5420,
    simpleSource: 'STOCK_BALANCE_WEIGHTED_AVERAGE',
  });
  assert.deepStrictEqual(result.dataQuality, {
    missingCostItems: 1,
    missingCostProducts: 0,
    missingCostQuantity: 0,
    hasIncompleteValuation: true,
    simpleLotQuantityDifference: -9989,
  });

  const trackedSimpleWhere = buildTrackedSimpleProductWhere(branchId);
  for (const [name, args] of calls) {
    assert.strictEqual(args.where.branchId, branchId, `${name} must be scoped to authenticated branchId`);
    if (name === 'stockBalance.findMany' || name.startsWith('simpleLot.')) {
      assert.deepStrictEqual(
        args.where.product,
        trackedSimpleWhere,
        `${name} must only include active TRACKED SIMPLE products owned by the authenticated branch`
      );
    }
  }

  const balanceCall = calls.find(([name]) => name === 'stockBalance.findMany');
  assert.ok(balanceCall, 'stockBalance.findMany must be executed');
  assert.deepStrictEqual(balanceCall[1].select, {
    quantity: true,
    reserved: true,
    avgCost: true,
    lastReceivedCost: true,
  });

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
