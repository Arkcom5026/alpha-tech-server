const prisma = require('../../../database/prisma/client');
const {
  publishDevicePassportEvent,
} = require('../../device/passport/publish/devicePassportEventPublisher');

class RepairEstimateApprovalRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new RepairEstimateApprovalRepository(tx))
    );
  }

  findRepairJobForStaff(repairJobId, branchId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      select: {
        id: true,
        jobNo: true,
        branchId: true,
        deviceId: true,
        status: true,
        estimatedCost: true,
        depositPaid: true,
      },
    });
  }

  findRepairJobWorkflowContext(repairJobId) {
    return this.prisma.repairJob.findUnique({
      where: { id: Number(repairJobId) },
      select: {
        id: true,
        jobNo: true,
        branchId: true,
        deviceId: true,
        status: true,
      },
    });
  }

  findLatestWorkflowEvent({ repairJobId, branchId, deviceId }) {
    if (!deviceId) return Promise.resolve(null);
    return this.prisma.devicePassportEvent.findFirst({
      where: {
        deviceId: Number(deviceId),
        branchId: Number(branchId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async supersedePending(repairJobId) {
    return this.prisma.$executeRaw`
      UPDATE "RepairEstimateApproval"
      SET "status" = 'SUPERSEDED'::"RepairEstimateApprovalStatus",
          "updatedAt" = NOW()
      WHERE "repairJobId" = ${Number(repairJobId)}
        AND "status" = 'PENDING'::"RepairEstimateApprovalStatus"
    `;
  }

  async create(data) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "RepairEstimateApproval"
        ("repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
         "status", "requestNote", "requestedByEmployeeId", "requestedAt",
         "expiresAt", "createdAt", "updatedAt")
      VALUES (
        ${Number(data.repairJobId)}, ${data.estimateAmount},
        ${data.depositAmount}, ${data.balanceAmount},
        'PENDING'::"RepairEstimateApprovalStatus", ${data.requestNote},
        ${data.requestedByEmployeeId ? Number(data.requestedByEmployeeId) : null},
        NOW(), ${data.expiresAt}, NOW(), NOW()
      )
      RETURNING
        "id", "repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
        "status", "requestNote", "customerNote", "confirmedByName",
        "requestedAt", "expiresAt", "decidedAt", "createdAt", "updatedAt"
    `;
    return rows[0] || null;
  }

  async findLatest(repairJobId) {
    const rows = await this.prisma.$queryRaw`
      SELECT
        "id", "repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
        "status", "requestNote", "customerNote", "confirmedByName",
        "requestedAt", "expiresAt", "decidedAt", "createdAt", "updatedAt"
      FROM "RepairEstimateApproval"
      WHERE "repairJobId" = ${Number(repairJobId)}
      ORDER BY "requestedAt" DESC, "id" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async findById(approvalId, repairJobId) {
    const rows = await this.prisma.$queryRaw`
      SELECT
        "id", "repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
        "status", "requestNote", "customerNote", "confirmedByName",
        "requestedAt", "expiresAt", "decidedAt", "createdAt", "updatedAt"
      FROM "RepairEstimateApproval"
      WHERE "id" = ${Number(approvalId)}
        AND "repairJobId" = ${Number(repairJobId)}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async decide({ approvalId, repairJobId, decision, confirmedByName, customerNote }) {
    const rows = await this.prisma.$queryRaw`
      UPDATE "RepairEstimateApproval"
      SET "status" = ${decision}::"RepairEstimateApprovalStatus",
          "confirmedByName" = ${confirmedByName},
          "customerNote" = ${customerNote},
          "decidedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "id" = ${Number(approvalId)}
        AND "repairJobId" = ${Number(repairJobId)}
        AND "status" = 'PENDING'::"RepairEstimateApprovalStatus"
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      RETURNING
        "id", "repairJobId", "estimateAmount", "depositAmount", "balanceAmount",
        "status", "requestNote", "customerNote", "confirmedByName",
        "requestedAt", "expiresAt", "decidedAt", "createdAt", "updatedAt"
    `;
    return rows[0] || null;
  }

  updateRepairStatus(repairJobId, status) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data: { status },
      select: { id: true, status: true },
    });
  }

  publishWorkflowEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new RepairEstimateApprovalRepository();
module.exports.RepairEstimateApprovalRepository = RepairEstimateApprovalRepository;
