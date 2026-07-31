const { prisma } = require('../../../../../../lib/prisma');
const {
  buildSimpleStockBackfillManifest,
} = require('../manifest/simpleStockBackfillManifest');

class SimpleStockBackfillExecutionRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction(
      (tx) => work(new SimpleStockBackfillExecutionRepository(tx)),
      { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 }
    );
  }

  async loadSnapshot(branchId) {
    const [balances, lots, movements] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { branchId: Number(branchId) },
        select: {
          id: true,
          branchId: true,
          productId: true,
          quantity: true,
          reserved: true,
          avgCost: true,
          lastReceivedCost: true,
        },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.simpleLot.findMany({
        where: { branchId: Number(branchId) },
        select: {
          id: true,
          branchId: true,
          productId: true,
        },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.stockMovement.findMany({
        where: { branchId: Number(branchId) },
        select: {
          id: true,
          branchId: true,
          productId: true,
          simpleLotId: true,
        },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return { balances, lots, movements };
  }

  async revalidateExecutionPlan({ executionPlan, approval, commandSet }) {
    const snapshot = await this.loadSnapshot(commandSet.branchId);
    const manifest = buildSimpleStockBackfillManifest({
      branchId: commandSet.branchId,
      ...snapshot,
    });

    const entriesById = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
    const operationResults = commandSet.commands.map((command) => {
      const current = entriesById.get(command.entryId);
      return {
        entryId: command.entryId,
        productId: command.productId,
        expectedPreconditionHash: command.preconditionHash,
        actualPreconditionHash: current?.preconditionHash || null,
        classification: current?.classification || null,
        matches:
          current?.classification === 'READY_FOR_APPROVAL' &&
          Number(current?.preconditions?.productId) === command.productId &&
          current?.preconditionHash === command.preconditionHash,
      };
    });

    return {
      manifestMatches:
        manifest.manifestId === approval.manifestId &&
        manifest.sourceSnapshotHash === approval.sourceSnapshotHash,
      planMatches:
        executionPlan.executionPlanId === approval.executionPlanId &&
        executionPlan.executionPlanHash === approval.executionPlanHash,
      currentManifestId: manifest.manifestId,
      currentSourceSnapshotHash: manifest.sourceSnapshotHash,
      operationResults,
    };
  }

  createSimpleLot(data) {
    return this.prisma.simpleLot.create({ data });
  }

  createStockMovement(data) {
    return this.prisma.stockMovement.create({ data });
  }

  recordExecutionAudit(data) {
    return Promise.resolve({
      auditType: 'SIMPLE_STOCK_BACKFILL_EXECUTION',
      recordedAt: new Date().toISOString(),
      ...data,
    });
  }
}

module.exports = new SimpleStockBackfillExecutionRepository();
module.exports.SimpleStockBackfillExecutionRepository = SimpleStockBackfillExecutionRepository;
