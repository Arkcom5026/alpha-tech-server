const prisma = require('../../../database/prisma/client');

const ACTIVE_STATUSES = ['SENT', 'RETURN_REQUESTED'];
const subcontractColumns = `"id", "branchId", "repairJobId", "expensePayeeId", "status", "providerName", "providerPhone",
  "workScope", "externalReference", "trackingNumber", "customerEstimateAmount",
  "customerApprovalNote", "providerQuotedAmount", "providerQuoteNote", "customerDecisionNote",
  "actualExternalCost", "transportCost", "materialCost", "otherOperationalCost", "resultNote", "sentAt", "expectedReturnAt", "returnRequestedAt",
  "returnedAt", "sentByEmployeeId", "returnedByEmployeeId", "createdAt", "updatedAt"`;

class RepairSubcontractRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new RepairSubcontractRepository(tx)));
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      select: {
        id: true,
        jobNo: true,
        branchId: true,
        deviceId: true,
        status: true,
        estimatedCost: true,
        warrantyClaims: { select: { id: true, claimNo: true, status: true } },
        deviceIntake: {
          select: {
            id: true,
            consent: {
              select: {
                allowOutsourceRepair: true,
                customerSignature: true,
                signedAt: true,
              },
            },
          },
        },
      },
    });
  }

  findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
    if (!deviceId) return Promise.resolve(null);
    return this.prisma.devicePassportEvent.findFirst({
      where: {
        branchId: Number(branchId),
        deviceId: Number(deviceId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { id: true, metadata: true, occurredAt: true },
    });
  }

  findExpensePayee(branchId, expensePayeeId) {
    return this.prisma.expensePayee.findFirst({
      where: { id: Number(expensePayeeId), branchId: Number(branchId), active: true },
      select: { id: true, name: true, phone: true, taxId: true },
    });
  }

  listRelatedExpenses(branchId, repairJobId, repairSubcontractId) {
    return this.prisma.taxExpense.findMany({
      where: { branchId: Number(branchId), repairJobId: Number(repairJobId), repairSubcontractId: Number(repairSubcontractId) },
      select: { id: true, expenseNumber: true, documentNumber: true, totalAmount: true, paymentDueAmount: true, evidenceStatus: true, expenseDate: true },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
    });
  }

  async findActive(repairJobId, { forUpdate = false } = {}) {
    const suffix = forUpdate ? ' FOR UPDATE' : '';
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT ${subcontractColumns}
       FROM "RepairSubcontract"
       WHERE "repairJobId" = $1 AND "status" IN ('SENT','RETURN_REQUESTED')
       ORDER BY "sentAt" DESC, "id" DESC
       LIMIT 1${suffix}`,
      Number(repairJobId)
    );
    return rows[0] || null;
  }

  async list(repairJobId) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ${subcontractColumns}
       FROM "RepairSubcontract"
       WHERE "repairJobId" = $1
       ORDER BY "sentAt" DESC, "id" DESC`,
      Number(repairJobId)
    );
  }

  async findById(branchId, repairJobId, subcontractId, { forUpdate = false } = {}) {
    const suffix = forUpdate ? ' FOR UPDATE' : '';
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT ${subcontractColumns}
       FROM "RepairSubcontract"
       WHERE "id" = $1 AND "repairJobId" = $2 AND "branchId" = $3
       LIMIT 1${suffix}`,
      Number(subcontractId),
      Number(repairJobId),
      Number(branchId)
    );
    return rows[0] || null;
  }

  async create(data) {
    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO "RepairSubcontract"
        ("branchId", "repairJobId", "expensePayeeId", "status", "providerName", "providerPhone", "workScope",
         "externalReference", "trackingNumber", "customerEstimateAmount", "customerApprovalNote",
         "sentAt", "expectedReturnAt", "sentByEmployeeId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'SENT',$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12,NOW(),NOW())
       RETURNING ${subcontractColumns}`,
      Number(data.branchId),
      Number(data.repairJobId),
      Number(data.expensePayeeId),
      data.providerName,
      data.providerPhone,
      data.workScope,
      data.externalReference,
      data.trackingNumber,
      data.customerEstimateAmount,
      data.customerApprovalNote,
      data.expectedReturnAt,
      Number(data.sentByEmployeeId)
    );
    return rows[0];
  }

  async updateDetails(branchId, repairJobId, subcontractId, data) {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE "RepairSubcontract"
       SET "providerPhone" = COALESCE($4, "providerPhone"),
           "externalReference" = COALESCE($5, "externalReference"),
           "trackingNumber" = COALESCE($6, "trackingNumber"),
           "expectedReturnAt" = COALESCE($7, "expectedReturnAt"),
           "providerQuotedAmount" = COALESCE($8, "providerQuotedAmount"),
           "providerQuoteNote" = COALESCE($9, "providerQuoteNote"),
           "customerDecisionNote" = COALESCE($10, "customerDecisionNote"),
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "repairJobId" = $2 AND "branchId" = $3
         AND "status" IN ('SENT','RETURN_REQUESTED')
       RETURNING ${subcontractColumns}`,
      Number(subcontractId),
      Number(repairJobId),
      Number(branchId),
      data.providerPhone,
      data.externalReference,
      data.trackingNumber,
      data.expectedReturnAt,
      data.providerQuotedAmount,
      data.providerQuoteNote,
      data.customerDecisionNote
    );
    return rows[0] || null;
  }

  async requestReturn(branchId, repairJobId, subcontractId, note) {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE "RepairSubcontract"
       SET "status" = 'RETURN_REQUESTED',
           "customerDecisionNote" = COALESCE($4, "customerDecisionNote"),
           "returnRequestedAt" = COALESCE("returnRequestedAt", NOW()),
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "repairJobId" = $2 AND "branchId" = $3
         AND "status" = 'SENT'
       RETURNING ${subcontractColumns}`,
      Number(subcontractId),
      Number(repairJobId),
      Number(branchId),
      note
    );
    return rows[0] || null;
  }

  async receiveReturn(branchId, repairJobId, subcontractId, data) {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE "RepairSubcontract"
       SET "status" = 'RETURNED',
           "actualExternalCost" = COALESCE($4, "actualExternalCost"),
           "transportCost" = COALESCE($5, "transportCost"),
           "materialCost" = COALESCE($6, "materialCost"),
           "otherOperationalCost" = COALESCE($7, "otherOperationalCost"),
           "resultNote" = COALESCE($8, "resultNote"),
           "returnedAt" = NOW(),
           "returnedByEmployeeId" = $9,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "repairJobId" = $2 AND "branchId" = $3
         AND "status" IN ('SENT','RETURN_REQUESTED')
       RETURNING ${subcontractColumns}`,
      Number(subcontractId),
      Number(repairJobId),
      Number(branchId),
      data.actualExternalCost,
      data.transportCost,
      data.materialCost,
      data.otherOperationalCost,
      data.resultNote,
      Number(data.returnedByEmployeeId)
    );
    return rows[0] || null;
  }

  async createTimelineEvent(event) {
    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO "RepairJobEvent"
        ("repairJobId", "eventType", "fromStatus", "toStatus", "customerVisible",
         "customerTitle", "customerMessage", "internalNote", "performedByEmployeeId",
         "metadata", "occurredAt", "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW(),NOW())
       RETURNING "id", "repairJobId", "eventType", "occurredAt"`,
      Number(event.repairJobId),
      event.eventType,
      event.fromStatus,
      event.toStatus,
      Boolean(event.customerVisible),
      event.customerTitle,
      event.customerMessage,
      event.internalNote,
      event.performedByEmployeeId ? Number(event.performedByEmployeeId) : null,
      JSON.stringify(event.metadata || {})
    );
    return rows[0] || null;
  }
}

module.exports = new RepairSubcontractRepository();
module.exports.RepairSubcontractRepository = RepairSubcontractRepository;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports.subcontractColumns = subcontractColumns;
