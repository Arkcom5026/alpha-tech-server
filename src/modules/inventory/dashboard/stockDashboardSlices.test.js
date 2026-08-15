const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GetStockDashboardOverviewRepository,
  GetStockDashboardOverviewService,
} = require('./query/overview/getStockDashboardOverviewSlice');
const {
  GetStockDashboardAuditInProgressRepository,
  GetStockDashboardAuditInProgressService,
} = require('./query/audit-in-progress/getStockDashboardAuditInProgressSlice');
const {
  GetStockDashboardRiskRepository,
  GetStockDashboardRiskService,
  RISK_STATUSES,
} = require('./query/risk/getStockDashboardRiskSlice');

test('overview repository keeps every inventory source branch-scoped', async () => {
  const received = [];
  const repository = new GetStockDashboardOverviewRepository({
    stockItem: {
      groupBy: async (query) => { received.push(query); return []; },
      aggregate: async (query) => { received.push(query); return { _sum: {}, _count: { _all: 0 } }; },
      count: async (query) => { received.push(query); return 0; },
    },
    stockBalance: {
      aggregate: async (query) => { received.push(query); return { _sum: {}, _count: { _all: 0 } }; },
      findMany: async (query) => { received.push(query); return []; },
    },
    simpleLot: {
      aggregate: async (query) => { received.push(query); return { _sum: {}, _count: { _all: 0 } }; },
      findMany: async (query) => { received.push(query); return []; },
    },
  });

  const start = new Date('2026-07-27T00:00:00.000Z');
  const end = new Date('2026-07-28T00:00:00.000Z');
  await Promise.all([
    repository.getStructuredByStatus(7),
    repository.getStructuredValuation(7),
    repository.countSoldToday(7, start, end),
    repository.getSimpleSummary(7),
    repository.getLotSummary(7),
  ]);

  assert.ok(received.length >= 7);
  assert.ok(received.every((query) => query.where.branchId === 7));
});

test('overview service preserves legacy and richer dashboard projections', async () => {
  const service = new GetStockDashboardOverviewService({
    getStructuredByStatus: async () => [
      { status: 'IN_STOCK', _count: { _all: 3 } },
      { status: 'CLAIMED', _count: { _all: 2 } },
      { status: 'MISSING_PENDING_REVIEW', _count: { _all: 1 } },
    ],
    getStructuredValuation: async () => ({ quantity: 3, costValue: 1500, missingCostCount: 1 }),
    countSoldToday: async () => 4,
    getSimpleSummary: async () => ({
      productCount: 2,
      qtyOnHand: 10,
      qtyReserved: 3,
      netAvailable: 7,
      costValue: 500,
      missingCostProductCount: 0,
      missingCostQuantity: 0,
    }),
    getLotSummary: async () => ({
      activeLotCount: 1,
      qtyRemaining: 5,
      costValue: 500,
      missingCostLotCount: 0,
      missingCostQuantity: 0,
    }),
  });

  const result = await service.execute(5, new Date('2026-07-27T10:00:00.000Z'));
  assert.equal(result.inStock, 3);
  assert.equal(result.claimed, 2);
  assert.equal(result.missingPendingReview, 1);
  assert.equal(result.soldToday, 4);
  assert.equal(result.structured.total, 6);
  assert.equal(result.structured.costValue, 1500);
  assert.equal(result.simple.netAvailable, 7);
  assert.equal(result.valuation.totalCostValue, 2000);
  assert.equal(result.dataQuality.hasIncompleteValuation, true);
  assert.equal(result.branchId, 5);
});

test('audit repository requests only active branch-owned sessions', async () => {
  let received;
  const repository = new GetStockDashboardAuditInProgressRepository({
    stockAuditSession: {
      findFirst: async (query) => { received = query; return null; },
    },
  });
  await repository.findCurrent(9);
  assert.equal(received.where.branchId, 9);
  assert.deepEqual(received.where.status.in, ['DRAFT', 'IN_PROGRESS']);
  assert.deepEqual(received.orderBy, { startedAt: 'desc' });
});

test('audit service normalizes missing active session to null', async () => {
  const service = new GetStockDashboardAuditInProgressService({ findCurrent: async () => undefined });
  assert.equal(await service.execute(1), null);
});

test('risk repository scopes statuses and branch authority', async () => {
  let received;
  const repository = new GetStockDashboardRiskRepository({
    stockItem: {
      groupBy: async (query) => { received = query; return []; },
    },
  });
  await repository.findCounts(12);
  assert.equal(received.where.branchId, 12);
  assert.deepEqual(received.where.status.in, RISK_STATUSES);
});

test('risk service maps every declared risk status and defaults missing values', async () => {
  const service = new GetStockDashboardRiskService({
    findCounts: async () => [
      { status: 'LOST', _count: { _all: 2 } },
      { status: 'USED', _count: { _all: 3 } },
    ],
  });
  const result = await service.execute(1, new Date('2026-07-27T10:00:00.000Z'));
  assert.deepEqual(result, {
    lost: 2,
    damaged: 0,
    used: 3,
    returned: 0,
    asOf: '2026-07-27T10:00:00.000Z',
  });
});