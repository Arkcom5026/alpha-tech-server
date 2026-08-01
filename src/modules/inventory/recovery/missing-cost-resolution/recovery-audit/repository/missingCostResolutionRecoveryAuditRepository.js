const prisma = require('../../../../../../../database/prisma/client');

class MissingCostResolutionRecoveryAuditRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findLatestExecution({ branchId, resolutionId }) {
    return this.prisma.missingCostResolutionEvent.findFirst({
      where: {
        resolutionId: Number(resolutionId),
        eventType: 'RECOVERY_EXECUTED',
        resolution: { branchId: Number(branchId) },
      },
      include: {
        version: true,
        resolution: {
          include: {
            stockBalance: {
              select: {
                id: true,
                branchId: true,
                productId: true,
                quantity: true,
                avgCost: true,
                lastReceivedCost: true,
              },
            },
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  findExecutionHistory({ branchId, resolutionId }) {
    return this.prisma.missingCostResolutionEvent.findMany({
      where: {
        resolutionId: Number(resolutionId),
        eventType: 'RECOVERY_EXECUTED',
        resolution: { branchId: Number(branchId) },
      },
      include: { version: true },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }
}

module.exports = new MissingCostResolutionRecoveryAuditRepository();
module.exports.MissingCostResolutionRecoveryAuditRepository = MissingCostResolutionRecoveryAuditRepository;
