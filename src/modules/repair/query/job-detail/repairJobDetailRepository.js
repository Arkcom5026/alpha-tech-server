const {
  findLatestRepairWorkflowEvent,
  findRepairWorkflowHistory,
} = require('../../workflow/events/repairWorkflowEventStore');

// Detail reads keep the relations consumed by the runtime mapper/workflow only.
// Purchase/sale history and full claim event graphs are loaded by their own
// bounded contexts and should not inflate every Repair Detail request.
const repairJobDetailInclude = {
  branch: true,
  customer: { include: { user: true } },
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
    },
  },
  device: true,
  deviceIntake: {
    include: {
      snapshot: true,
    },
  },
  technician: true,
  partsUsed: { include: { product: true } },
  warrantyClaims: {
    include: { supplier: true },
    orderBy: { openedAt: 'desc' },
  },
};

class RepairJobDetailRepository {
  constructor(client = null) {
    this.client = client;
  }

  getPrisma() {
    if (!this.client) {
      this.client = require('../../../../database/prisma/client');
    }
    return this.client;
  }

  async findById(branchId, repairJobId) {
    const prisma = this.getPrisma();
    const id = Number(repairJobId);
    const branch = Number(branchId);

    // Every read in this first wave is independently branch-scoped. Starting
    // them together removes an avoidable database round-trip from the critical
    // Repair Detail path without weakening tenant/branch isolation.
    const jobPromise = prisma.repairJob.findFirst({
      where: {
        id,
        branchId: branch,
      },
      include: repairJobDetailInclude,
    });

    const serializedPartMovementsPromise = prisma.stockMovement.findMany({
      where: {
        branchId: branch,
        refType: 'REPAIR_JOB_PART_USAGE',
        refId: id,
        stockItemId: { not: null },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        qty: true,
        stockItemId: true,
        previousStockStatus: true,
        resultingStockStatus: true,
        occurredAt: true,
        performedByEmployeeId: true,
        stockItem: {
          select: {
            id: true,
            barcode: true,
            serialNumber: true,
            status: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    const activeSubcontractPromise = typeof prisma.$queryRawUnsafe === 'function'
      ? prisma.$queryRawUnsafe(
          `SELECT "id", "status", "providerName", "providerPhone", "workScope",
                  "externalReference", "trackingNumber", "customerEstimateAmount",
                  "customerApprovalNote", "providerQuotedAmount", "providerQuoteNote",
                  "customerDecisionNote", "actualExternalCost", "resultNote", "sentAt",
                  "expectedReturnAt", "returnRequestedAt", "returnedAt", "updatedAt"
           FROM "RepairSubcontract"
           WHERE "repairJobId" = $1 AND "branchId" = $2
             AND "status" IN ('SENT','RETURN_REQUESTED')
           ORDER BY "sentAt" DESC, "id" DESC
           LIMIT 1`,
          id,
          branch
        ).then((rows) => rows[0] || null)
      : Promise.resolve(null);

    const repairOwnedLatestPromise = findLatestRepairWorkflowEvent(prisma, {
      repairJobId: id,
      branchId: branch,
    });
    const repairOwnedHistoryPromise = findRepairWorkflowHistory(prisma, {
      repairJobId: id,
      branchId: branch,
      take: 50,
    });

    const [
      job,
      repairOwnedLatest,
      repairOwnedHistory,
      serializedPartMovements,
      activeSubcontract,
    ] = await Promise.all([
      jobPromise,
      repairOwnedLatestPromise,
      repairOwnedHistoryPromise,
      serializedPartMovementsPromise,
      activeSubcontractPromise,
    ]);

    if (!job) return null;

    let passportLatest = null;
    let passportDiagnosis = null;
    let passportHistory = [];

    // Device Passport is an optional trace projection. Only linked-device jobs
    // pay for these reads; passport-less Repair jobs stay on Repair-owned
    // workflow authority without an extra database wave.
    if (job.deviceId) {
      const eventScope = {
        deviceId: Number(job.deviceId),
        branchId: branch,
        sourceType: 'REPAIR_JOB',
        sourceId: String(id),
      };
      [passportLatest, passportDiagnosis, passportHistory] = await Promise.all([
        prisma.devicePassportEvent.findFirst({
          where: eventScope,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        }),
        prisma.devicePassportEvent.findFirst({
          where: {
            ...eventScope,
            eventType: 'DIAGNOSIS_COMPLETED',
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        }),
        prisma.devicePassportEvent.findMany({
          where: eventScope,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: 50,
          select: {
            id: true,
            eventType: true,
            title: true,
            description: true,
            occurredAt: true,
            metadata: true,
          },
        }),
      ]);
    }

    const repairOwnedDiagnosis = repairOwnedHistory.find(
      (event) => event.eventType === 'DIAGNOSIS_COMPLETED'
    ) || null;

    return {
      ...job,
      repairWorkflowEvent: repairOwnedLatest || passportLatest || null,
      repairDiagnosisEvent: repairOwnedDiagnosis || passportDiagnosis || null,
      repairWorkflowHistory:
        repairOwnedHistory.length > 0 ? repairOwnedHistory : passportHistory,
      serializedPartMovements,
      activeSubcontract,
    };
  }
}

module.exports = new RepairJobDetailRepository();
module.exports.RepairJobDetailRepository = RepairJobDetailRepository;
module.exports.repairJobDetailInclude = repairJobDetailInclude;
