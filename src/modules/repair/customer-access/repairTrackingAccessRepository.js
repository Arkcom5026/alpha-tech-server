const prisma = require('../../../database/prisma/client');

class RepairTrackingAccessRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findRepairJobForStaff(repairJobId, branchId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      select: { id: true, jobNo: true, branchId: true },
    });
  }

  async revokeActiveForJob(repairJobId) {
    return this.prisma.$executeRaw`
      UPDATE "RepairTrackingAccess"
      SET "revokedAt" = NOW(), "updatedAt" = NOW()
      WHERE "repairJobId" = ${Number(repairJobId)}
        AND "revokedAt" IS NULL
    `;
  }

  async create({ repairJobId, tokenHash, expiresAt, createdByEmployeeId }) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "RepairTrackingAccess"
        ("repairJobId", "tokenHash", "expiresAt", "createdByEmployeeId", "createdAt", "updatedAt")
      VALUES
        (${Number(repairJobId)}, ${tokenHash}, ${expiresAt}, ${createdByEmployeeId ? Number(createdByEmployeeId) : null}, NOW(), NOW())
      RETURNING "id", "repairJobId", "expiresAt", "createdAt"
    `;
    return rows[0] || null;
  }

  async findValidByTokenHash(tokenHash) {
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "repairJobId", "expiresAt", "lastAccessedAt", "createdAt"
      FROM "RepairTrackingAccess"
      WHERE "tokenHash" = ${tokenHash}
        AND "revokedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async touch(accessId) {
    return this.prisma.$executeRaw`
      UPDATE "RepairTrackingAccess"
      SET "lastAccessedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${Number(accessId)}
    `;
  }

  async getPublicRepairProjection(repairJobId) {
    return this.prisma.repairJob.findUnique({
      where: { id: Number(repairJobId) },
      select: {
        id: true,
        jobNo: true,
        branchId: true,
        deviceId: true,
        deviceModel: true,
        reportedSymptoms: true,
        status: true,
        estimatedCost: true,
        depositPaid: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            name: true,
            companyName: true,
            departmentName: true,
          },
        },
        branch: { select: { name: true, phone: true, address: true } },
        stockItem: {
          select: {
            barcode: true,
            serialNumber: true,
            product: {
              select: {
                name: true,
                brand: { select: { name: true } },
                productType: { select: { name: true } },
              },
            },
          },
        },
        device: {
          select: {
            id: true,
            barcode: true,
            serialNumber: true,
            imei: true,
            brand: true,
            model: true,
            category: true,
            passportEvents: {
              where: { customerVisible: true },
              orderBy: { occurredAt: 'asc' },
              take: 30,
              select: {
                eventType: true,
                title: true,
                description: true,
                occurredAt: true,
                metadata: true,
              },
            },
          },
        },
        deviceIntake: {
          select: {
            referenceNo: true,
            receivedAt: true,
            snapshot: {
              select: {
                brand: true,
                model: true,
                serialNumber: true,
                imei: true,
                barcode: true,
              },
            },
            accessories: {
              select: {
                accessoryType: true,
                quantity: true,
                remark: true,
              },
            },
          },
        },
        warrantyClaims: {
          orderBy: { openedAt: 'desc' },
          take: 1,
          select: {
            claimNo: true,
            status: true,
            serviceProvider: true,
            openedAt: true,
            updatedAt: true,
          },
        },
        delivery: {
          select: {
            status: true,
            customerConfirmedBy: true,
            customerConfirmedAt: true,
            deliveredAt: true,
          },
        },
      },
    });
  }

  async findLatestWorkflowEvent(repairJobId, deviceId, branchId) {
    if (!deviceId) return null;
    return this.prisma.devicePassportEvent.findFirst({
      where: {
        deviceId: Number(deviceId),
        branchId: Number(branchId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { metadata: true, occurredAt: true },
    });
  }

  async listCustomerVisibleTimelineEvents(repairJobId) {
    return this.prisma.$queryRaw`
      SELECT
        "id",
        "eventType",
        "fromStatus",
        "toStatus",
        "customerTitle",
        "customerMessage",
        "occurredAt",
        "metadata"
      FROM "RepairJobEvent"
      WHERE "repairJobId" = ${Number(repairJobId)}
        AND "customerVisible" = true
      ORDER BY "occurredAt" ASC, "id" ASC
    `;
  }

  async getLatestEstimateApproval(repairJobId) {
    const rows = await this.prisma.$queryRaw`
      SELECT
        "id", "repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
        "status", "requestNote", "customerNote", "confirmedByName",
        "requestedAt", "expiresAt", "decidedAt"
      FROM "RepairEstimateApproval"
      WHERE "repairJobId" = ${Number(repairJobId)}
      ORDER BY "requestedAt" DESC, "id" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }
}

module.exports = new RepairTrackingAccessRepository();
module.exports.RepairTrackingAccessRepository = RepairTrackingAccessRepository;
