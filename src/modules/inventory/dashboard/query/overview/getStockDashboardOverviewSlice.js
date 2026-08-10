const prismaModule = require('../../../../../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  getBranchIdFromRequest,
  buildStatusCountMap,
  sumStatuses,
  sendStockDashboardError,
} = require('../../shared/stockDashboardShared');

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const buildTrackedSimpleProductWhere = (branchId) => ({
  mode: 'SIMPLE',
  inventoryBehavior: 'TRACKED',
  active: true,
  productType: { branchId: Number(branchId) },
});

class GetStockDashboardOverviewRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  async getStructuredByStatus(branchId) {
    return this.prisma.stockItem.groupBy({
      by: ['status'],
      where: { branchId },
      _count: { _all: true },
    });
  }

  async getStructuredValuation(branchId) {
    const [aggregate, missingCostCount] = await Promise.all([
      this.prisma.stockItem.aggregate({
        where: { branchId, status: 'IN_STOCK' },
        _count: { _all: true },
        _sum: { costPrice: true },
      }),
      this.prisma.stockItem.count({
        where: {
          branchId,
          status: 'IN_STOCK',
          OR: [{ costPrice: null }, { costPrice: { lte: 0 } }],
        },
      }),
    ]);

    return {
      quantity: Number(aggregate?._count?._all || 0),
      costValue: toNumber(aggregate?._sum?.costPrice),
      missingCostCount: Number(missingCostCount || 0),
    };
  }

  async countSoldToday(branchId, startOfDay, startOfNextDay) {
    const bySoldAt = await this.prisma.stockItem.count({
      where: {
        branchId,
        status: 'SOLD',
        soldAt: { gte: startOfDay, lt: startOfNextDay },
      },
    });
    if (bySoldAt > 0) return bySoldAt;
    return this.prisma.stockItem.count({
      where: {
        branchId,
        status: 'SOLD',
        updatedAt: { gte: startOfDay, lt: startOfNextDay },
      },
    });
  }

  async getSimpleSummary(branchId) {
    const rows = await this.prisma.stockBalance.findMany({
      where: {
        branchId,
        product: buildTrackedSimpleProductWhere(branchId),
      },
      select: {
        quantity: true,
        reserved: true,
        avgCost: true,
        lastReceivedCost: true,
      },
    });

    let qtyOnHand = 0;
    let qtyReserved = 0;
    let costValue = 0;
    let missingCostProductCount = 0;
    let missingCostQuantity = 0;

    for (const row of rows) {
      const quantity = toNumber(row.quantity);
      const reserved = toNumber(row.reserved);
      const avgCost = toNumber(row.avgCost, NaN);
      const fallbackCost = toNumber(row.lastReceivedCost, NaN);
      const unitCost = Number.isFinite(avgCost) && avgCost > 0 ? avgCost : fallbackCost;

      qtyOnHand += quantity;
      qtyReserved += reserved;

      if (quantity <= 0) continue;
      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        missingCostProductCount += 1;
        missingCostQuantity += quantity;
        continue;
      }
      costValue += quantity * unitCost;
    }

    return {
      productCount: rows.length,
      qtyOnHand,
      qtyReserved,
      netAvailable: qtyOnHand - qtyReserved,
      costValue,
      missingCostProductCount,
      missingCostQuantity,
    };
  }

  async getLotSummary(branchId) {
    const lotWhere = {
      branchId,
      status: 'ACTIVE',
      qtyRemaining: { gt: 0 },
      product: buildTrackedSimpleProductWhere(branchId),
    };
    const aggregate = await this.prisma.simpleLot.aggregate({
      where: lotWhere,
      _count: { _all: true },
      _sum: { qtyRemaining: true },
    });

    return {
      activeLotCount: Number(aggregate?._count?._all || 0),
      qtyRemaining: toNumber(aggregate?._sum?.qtyRemaining),
    };
  }
}

class GetStockDashboardOverviewService {
  constructor(repository = new GetStockDashboardOverviewRepository()) {
    this.repository = repository;
  }

  async execute(branchId, now = new Date()) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    const [structuredByStatus, structuredValuation, soldToday, simple, lot] = await Promise.all([
      this.repository.getStructuredByStatus(branchId),
      this.repository.getStructuredValuation(branchId),
      this.repository.countSoldToday(branchId, startOfDay, startOfNextDay),
      this.repository.getSimpleSummary(branchId),
      this.repository.getLotSummary(branchId),
    ]);

    const statusCounts = buildStatusCountMap(structuredByStatus);
    const structured = {
      total: Object.values(statusCounts).reduce((sum, value) => sum + Number(value || 0), 0),
      inStock: sumStatuses(statusCounts, ['IN_STOCK']),
      claimed: sumStatuses(statusCounts, ['CLAIMED']),
      missingPendingReview: sumStatuses(statusCounts, ['MISSING_PENDING_REVIEW']),
      soldToday: Number(soldToday || 0),
      statusCounts,
      costValue: structuredValuation.costValue,
      missingCostCount: structuredValuation.missingCostCount,
    };

    const structuredCostValue = toNumber(structuredValuation.costValue);
    const simpleCostValue = toNumber(simple.costValue);
    const totalCostValue = structuredCostValue + simpleCostValue;
    const missingCostItems = Number(structuredValuation.missingCostCount || 0);
    const missingCostProducts = Number(simple.missingCostProductCount || 0);
    const simpleLotQuantityDifference = toNumber(simple.qtyOnHand) - toNumber(lot.qtyRemaining);

    return {
      inStock: structured.inStock,
      claimed: structured.claimed,
      soldToday: structured.soldToday,
      missingPendingReview: structured.missingPendingReview,
      structured,
      simple,
      lot,
      valuation: {
        structuredCostValue,
        simpleCostValue,
        totalCostValue,
        simpleSource: 'STOCK_BALANCE_WEIGHTED_AVERAGE',
      },
      dataQuality: {
        missingCostItems,
        missingCostProducts,
        missingCostQuantity: toNumber(simple.missingCostQuantity),
        hasIncompleteValuation: missingCostItems > 0 || missingCostProducts > 0,
        simpleLotQuantityDifference,
      },
      scope: {
        branchId,
        calculatedAt: now.toISOString(),
      },
      asOf: now.toISOString(),
      branchId,
    };
  }
}

class GetStockDashboardOverviewController {
  constructor(service = new GetStockDashboardOverviewService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = getBranchIdFromRequest(req);
      if (!branchId) {
        return res.status(403).json({
          ok: false,
          error: 'INVENTORY_BRANCH_SCOPE_REQUIRED',
          message: 'ไม่พบขอบเขตร้านของผู้ใช้งาน',
        });
      }
      return res.json({ ok: true, data: await this.service.execute(branchId) });
    } catch (error) {
      return sendStockDashboardError(res, error, 'ไม่สามารถโหลดข้อมูลภาพรวมงานสต๊อกได้');
    }
  }
}

module.exports = new GetStockDashboardOverviewController();
module.exports.GetStockDashboardOverviewController = GetStockDashboardOverviewController;
module.exports.GetStockDashboardOverviewService = GetStockDashboardOverviewService;
module.exports.GetStockDashboardOverviewRepository = GetStockDashboardOverviewRepository;
module.exports.buildTrackedSimpleProductWhere = buildTrackedSimpleProductWhere;
