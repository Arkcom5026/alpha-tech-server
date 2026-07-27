const prismaModule = require('../../../../../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  getBranchIdFromRequest,
  sendStockDashboardError,
} = require('../../shared/stockDashboardShared');

class GetStockDashboardAuditInProgressRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findCurrent(branchId) {
    if (!this.prisma?.stockAuditSession?.findFirst) return null;
    return this.prisma.stockAuditSession.findFirst({
      where: {
        branchId,
        status: { in: ['DRAFT', 'IN_PROGRESS'] },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        mode: true,
        status: true,
        expectedCount: true,
        scannedCount: true,
        startedAt: true,
        confirmedAt: true,
        cancelledAt: true,
        note: true,
        employee: { select: { id: true, name: true, phone: true } },
      },
    });
  }
}

class GetStockDashboardAuditInProgressService {
  constructor(repository = new GetStockDashboardAuditInProgressRepository()) {
    this.repository = repository;
  }

  async execute(branchId) {
    return (await this.repository.findCurrent(branchId)) || null;
  }
}

class GetStockDashboardAuditInProgressController {
  constructor(service = new GetStockDashboardAuditInProgressService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = getBranchIdFromRequest(req);
      if (!branchId) return res.status(400).json({ ok: false, error: 'ไม่พบ branchId' });
      return res.json({ ok: true, data: await this.service.execute(branchId) });
    } catch (error) {
      return sendStockDashboardError(res, error, 'ไม่สามารถโหลดข้อมูลการตรวจนับได้');
    }
  }
}

module.exports = new GetStockDashboardAuditInProgressController();
module.exports.GetStockDashboardAuditInProgressController = GetStockDashboardAuditInProgressController;
module.exports.GetStockDashboardAuditInProgressService = GetStockDashboardAuditInProgressService;
module.exports.GetStockDashboardAuditInProgressRepository = GetStockDashboardAuditInProgressRepository;
