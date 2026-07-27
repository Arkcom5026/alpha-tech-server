const { prisma } = require('../../../../../../lib/prisma');
const { listInclude, parseStatusCsv } = require('../../shared/purchaseOrderShared');

class ListPurchaseOrdersRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findMany(branchId, query = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const search = String(query.search || '').trim();
    const statuses = parseStatusCsv(query.status);
    return this.prisma.purchaseOrder.findMany({
      where: {
        branchId: Number(branchId),
        ...(statuses.length ? { status: { in: statuses } } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                {
                  supplier: {
                    is: { name: { contains: search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}

class ListPurchaseOrdersService {
  constructor(repository = new ListPurchaseOrdersRepository()) {
    this.repository = repository;
  }

  execute(branchId, query) {
    return this.repository.findMany(branchId, query);
  }
}

class ListPurchaseOrdersController {
  constructor(service = new ListPurchaseOrdersService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = Number(req.user?.branchId);
      if (!branchId) {
        return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
      }
      return res.json(await this.service.execute(branchId, req.query));
    } catch (error) {
      console.error('❌ listPurchaseOrders error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new ListPurchaseOrdersController();
module.exports.ListPurchaseOrdersController = ListPurchaseOrdersController;
module.exports.ListPurchaseOrdersService = ListPurchaseOrdersService;
module.exports.ListPurchaseOrdersRepository = ListPurchaseOrdersRepository;
