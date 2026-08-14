const prisma = require('../../../database/prisma/client');
const {
  findLatestRepairWorkflowEvent,
} = require('../workflow/events/repairWorkflowEventStore');

const columns = `"id", "repairJobId", "status", "method", "recipientName",
  "recipientPhone", "customerConfirmedBy", "customerConfirmedAt", "customerNote",
  "paymentConfirmed", "deviceReturned", "accessoriesReturned", "deliveredAt",
  "createdAt", "updatedAt"`;

class RepairHandoverRepository {
  constructor(client = prisma) { this.prisma = client; }

  findJob(repairJobId, branchId = null) {
    return this.prisma.repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        ...(branchId ? { branchId: Number(branchId) } : {}),
      },
      select: {
        id: true, jobNo: true, branchId: true, customerId: true, deviceId: true,
        status: true, estimatedCost: true, depositPaid: true,
        deviceIntake: {
          select: {
            id: true,
            accessories: { select: { accessoryType: true, quantity: true, remark: true } },
          },
        },
      },
    });
  }

  async findActiveSubcontract(repairJobId) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "status", "providerName"
       FROM "RepairSubcontract"
       WHERE "repairJobId" = $1 AND "status" IN ('SENT','RETURN_REQUESTED')
       ORDER BY "sentAt" DESC, "id" DESC
       LIMIT 1`,
      Number(repairJobId)
    );
    return rows[0] || null;
  }

  async findLatestWorkflowEvent(repairJobId, deviceId, branchId) {
    const repairOwnedPromise = findLatestRepairWorkflowEvent(this.prisma, {
      repairJobId: Number(repairJobId),
      branchId: Number(branchId),
    });

    const passportPromise = deviceId
      ? this.prisma.devicePassportEvent.findFirst({
          where: {
            deviceId: Number(deviceId),
            branchId: Number(branchId),
            sourceType: 'REPAIR_JOB',
            sourceId: String(repairJobId),
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        })
      : Promise.resolve(null);

    const [repairOwned, passport] = await Promise.all([
      repairOwnedPromise,
      passportPromise,
    ]);
    return repairOwned || passport || null;
  }

  async findDelivery(repairJobId) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT ${columns} FROM "RepairDelivery" WHERE "repairJobId" = $1 LIMIT 1`,
      Number(repairJobId)
    );
    return rows[0] || null;
  }

  async confirmCustomer(repairJobId, input) {
    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO "RepairDelivery"
        ("repairJobId","status","method","recipientName","recipientPhone",
         "customerConfirmedBy","customerConfirmedAt","customerNote","createdAt","updatedAt")
       VALUES ($1,'READY','PICKUP_AT_BRANCH',$2,$3,$2,NOW(),$4,NOW(),NOW())
       ON CONFLICT ("repairJobId") DO UPDATE SET
         "status" = CASE WHEN "RepairDelivery"."status" = 'DELIVERED' THEN 'DELIVERED'::"RepairDeliveryStatus" ELSE 'READY'::"RepairDeliveryStatus" END,
         "recipientName" = EXCLUDED."recipientName",
         "recipientPhone" = EXCLUDED."recipientPhone",
         "customerConfirmedBy" = EXCLUDED."customerConfirmedBy",
         "customerConfirmedAt" = COALESCE("RepairDelivery"."customerConfirmedAt", NOW()),
         "customerNote" = EXCLUDED."customerNote", "updatedAt" = NOW()
       RETURNING ${columns}`,
      Number(repairJobId), input.receiverName, input.receiverPhone, input.note
    );
    return rows[0];
  }

  finalize(repairJobId, employeeId, input, snapshot) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(
        `UPDATE "RepairDelivery" SET "status"='DELIVERED',
          "deliveredByEmployeeId"=$2, "paymentConfirmed"=TRUE,
          "deviceReturned"=TRUE, "accessoriesReturned"=TRUE,
          "note"=$3, "handoverSnapshot"=$4::jsonb, "deliveredAt"=NOW(), "updatedAt"=NOW()
         WHERE "repairJobId"=$1 AND "customerConfirmedAt" IS NOT NULL
         RETURNING ${columns}`,
        Number(repairJobId), Number(employeeId), input.note, JSON.stringify(snapshot)
      );
      if (!rows[0]) return null;

      await tx.repairJob.update({
        where: { id: Number(repairJobId) },
        data: { status: 'COMPLETED' },
      });
      await tx.device.updateMany({
        where: { repairJobs: { some: { id: Number(repairJobId) } } },
        data: { status: 'ACTIVE' },
      });
      const job = await tx.repairJob.findUnique({
        where: { id: Number(repairJobId) },
        select: { id: true, jobNo: true, branchId: true, deviceId: true, deviceIntake: { select: { id: true } } },
      });
      if (job?.deviceId) {
        await tx.devicePassportEvent.create({
          data: {
            deviceId: job.deviceId,
            eventType: 'DELIVERED',
            sourceType: 'REPAIR_JOB',
            sourceId: String(repairJobId),
            eventKey: `repair-workflow:${repairJobId}:handover-delivered`,
            correlationId: `repair-job:${repairJobId}`,
            causationId: `repair-handover:${rows[0].id}`,
            title: `งานซ่อม ${job.jobNo}: ส่งมอบแล้ว`,
            description: `ผู้รับ: ${rows[0].customerConfirmedBy}`,
            actorType: 'EMPLOYEE',
            actorEmployeeId: Number(employeeId),
            branchId: snapshot.branchId,
            customerVisible: true,
            metadata: {
              repairJobId: Number(repairJobId),
              action: 'DELIVER',
              workflowPreviousStatus: 'READY_FOR_DELIVERY',
              workflowTargetStatus: 'DELIVERED',
              legacyServiceStatus: 'COMPLETED',
              terminal: false,
              handover: snapshot,
            },
            occurredAt: new Date(),
          },
        });
      }
      if (job?.deviceIntake?.id) {
        await tx.deviceIntakeAudit.create({
          data: {
            deviceIntakeId: job.deviceIntake.id, eventType: 'STATUS_CHANGED',
            performedByEmployeeId: Number(employeeId),
            note: 'ส่งมอบอุปกรณ์คืนลูกค้าแล้ว', metadata: snapshot,
          },
        });
      }
      return rows[0];
    });
  }
}

module.exports = new RepairHandoverRepository();
module.exports.RepairHandoverRepository = RepairHandoverRepository;
