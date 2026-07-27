const prismaModule = require('../../../../../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  getBranchIdFromRequest,
  buildStatusCountMap,
  sendStockDashboardError,
} = require('../../shared/stockDashboardShared');

const RISK_STATUSES = ['LOST', 'DAMAGED', 'USED', 'RETURNED'];

class GetStockDashboardRiskRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findCounts(branchId) {
    if (!this.prisma?.stockItem?.groupBy) return [];
    return this.prisma.stockItem.groupBy({
      by: ['status'],
      where: {
        branchId,
        status: { in: RISK_STATUSES },
      },
      _count: { _all: true },
    });
  }
}

class GetStockDashboardRiskService {
  constructor(repository = new GetStockDashboardRiskRepository()) {
    this.repository = repository;
  }

  async execute(branchId, now = new Date()) {
    const counts = buildStatusCountMap(await this.repository.findCounts(branchId));
    return {
      lost: counts.LOST || 0,
      damaged: counts.DAMAGED || 0,
      used: counts.USED || 0,
      returned: counts.RETURNED || 0,
      asOf: now.toISOString(),
    };
  }
}

class GetStockDashboardRiskController {
  constructor(service = new GetStockDashboardRiskService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = getBranchIdFromRequest(req);
      if (!branchId) return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
      return res.json({ ok: true, data: await this.service.execute(branchId) });
    } catch (error) {
      return sendStockDashboardError(res, error, 'ไม่สามารถโหลดข้อมูลความเสี่ยงสต๊อกได้');
    }
  }
}

module.exports = new GetStockDashboardRiskController();
module.exports.GetStockDashboardRiskController = GetStockDashboardRiskController;
module.exports.GetStockDashboardRiskService = GetStockDashboardRiskService;
module.exports.GetStockDashboardRiskRepository = GetStockDashboardRiskRepository;
module.exports.RISK_STATUSES = RISK_STATUSES;
