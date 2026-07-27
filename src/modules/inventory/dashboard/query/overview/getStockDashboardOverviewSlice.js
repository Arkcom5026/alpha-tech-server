const prismaModule = require('../../../../../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  getBranchIdFromRequest,
  buildStatusCountMap,
  sumStatuses,
  sendStockDashboardError,
} = require('../../shared/stockDashboardShared');

class GetStockDashboardOverviewRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  async getStructuredByStatus(branchId) {
    try {
      if (!this.prisma?.stockItem?.groupBy) return [];
      return await this.prisma.stockItem.groupBy({
        by: ['status'],
        where: { branchId },
        _count: { _all: true },
      });
    } catch (error) {
      console.warn('⚠️ stockDashboard structuredByStatus skipped:', error?.message || error);
      return [];
    }
  }

  async countSoldToday(branchId, startOfDay, startOfNextDay) {
    try {
      if (!this.prisma?.stockItem?.count) return 0;
      const bySoldAt = await this.prisma.stockItem.count({
        where: {
          branchId,
          status: 'SOLD',
          soldAt: { gte: startOfDay, lt: startOfNextDay },
        },
      });
      if (bySoldAt > 0) return bySoldAt;
      return await this.prisma.stockItem.count({
        where: {
          branchId,
          status: 'SOLD',
          updatedAt: { gte: startOfDay, lt: startOfNextDay },
        },
      });
    } catch (error) {
      console.warn('⚠️ stockDashboard soldToday skipped:', error?.message || error);
      return 0;
    }
  }

  async getSimpleSummary(branchId) {
    try {
      if (!this.prisma?.stockBalance?.aggregate) return null;
      const aggregate = await this.prisma.stockBalance.aggregate({
        where: { branchId },
        _sum: { quantity: true, reserved: true },
        _count: { _all: true },
      });
      const qtyOnHand = Number(aggregate?._sum?.quantity || 0);
      const qtyReserved = Number(aggregate?._sum?.reserved || 0);
      return {
        productCount: aggregate?._count?._all || 0,
        qtyOnHand,
        qtyReserved,
        netAvailable: qtyOnHand - qtyReserved,
      };
    } catch (error) {
      console.warn('⚠️ stockDashboard simpleSummary skipped:', error?.message || error);
      return null;
    }
  }

  async getLotSummary(branchId) {
    try {
      if (!this.prisma?.simpleLot?.aggregate) return null;
      const aggregate = await this.prisma.simpleLot.aggregate({
        where: { branchId, status: 'ACTIVE' },
        _count: { _all: true },
        _sum: { qtyRemaining: true },
      });
      return {
        activeLotCount: aggregate?._count?._all || 0,
        qtyRemaining: Number(aggregate?._sum?.qtyRemaining || 0),
      };
    } catch (error) {
      console.warn('⚠️ stockDashboard lotSummary skipped:', error?.message || error);
      return null;
    }
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

    const [structuredByStatus, soldToday, simple, lot] = await Promise.all([
      this.repository.getStructuredByStatus(branchId),
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
    };

    return {
      inStock: structured.inStock,
      claimed: structured.claimed,
      soldToday: structured.soldToday,
      missingPendingReview: structured.missingPendingReview,
      structured,
      simple,
      lot,
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
      if (!branchId) return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
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
