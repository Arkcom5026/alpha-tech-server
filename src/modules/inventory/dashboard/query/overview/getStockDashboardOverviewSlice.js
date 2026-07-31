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
    const aggregate = await this.prisma.stockBalance.aggregate({
      where: { branchId },
      _sum: { quantity: true, reserved: true },
      _count: { _all: true },
    });
    const qtyOnHand = toNumber(aggregate?._sum?.quantity);
    const qtyReserved = toNumber(aggregate?._sum?.reserved);
    return {
      productCount: Number(aggregate?._count?._all || 0),
      qtyOnHand,
      qtyReserved,
      netAvailable: qtyOnHand - qtyReserved,
    };
  }

  async getLotSummary(branchId) {
    const [aggregate, valuationRows] = await Promise.all([
      this.prisma.simpleLot.aggregate({
        where: { branchId, status: 'ACTIVE', qtyRemaining: { gt: 0 } },
        _count: { _all: true },
        _sum: { qtyRemaining: true },
      }),
      this.prisma.simpleLot.findMany({
        where: { branchId, status: 'ACTIVE', qtyRemaining: { gt: 0 } },
        select: { qtyRemaining: true, unitCost: true },
      }),
    ]);

    let costValue = 0;
    let missingCostLotCount = 0;
    let missingCostQuantity = 0;
    for (const row of valuationRows) {
      const quantity = toNumber(row.qtyRemaining);
      const unitCost = toNumber(row.unitCost, NaN);
      if (!Number.isFinite(unitCost) || unitCost <= 0) {
        missingCostLotCount += 1;
        missingCostQuantity += quantity;
        continue;
      }
      costValue += quantity * unitCost;
    }

    return {
      activeLotCount: Number(aggregate?._count?._all || 0),
      qtyRemaining: toNumber(aggregate?._sum?.qtyRemaining),
      costValue,
      missingCostLotCount,
      missingCostQuantity,
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
    const simpleCostValue = toNumber(lot.costValue);
    const totalCostValue = structuredCostValue + simpleCostValue;
    const missingCostItems = Number(structuredValuation.missingCostCount || 0);
    const missingCostLots = Number(lot.missingCostLotCount || 0);

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
      },
      dataQuality: {
        missingCostItems,
        missingCostLots,
        missingCostQuantity: toNumber(lot.missingCostQuantity),
        hasIncompleteValuation: missingCostItems > 0 || missingCostLots > 0,
        quantityReconciliationDifference: toNumber(simple.qtyOnHand) - toNumber(lot.qtyRemaining),
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
