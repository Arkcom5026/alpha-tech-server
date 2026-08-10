const repository = require('./createRepairJobRepository');
const { validateCreateRepairJob } = require('../validators/repairValidator');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const {
  assertStockItemBranch,
  assertNoActiveRepair,
  assertNoActiveClaim,
  assertCustomerMatchesLatestSale,
} = require('../policies/repairIntakePolicy');
const { createRepairJobNo } = require('../utils/repairCode');
const { mapRepairJob } = require('../mappers/repairMapper');

function isPrismaUniqueConflict(error) {
  return error?.code === 'P2002';
}

class CreateRepairJobService {
  constructor(createRepository = repository) {
    this.repository = createRepository;
  }

  async execute(actor, rawPayload) {
    const payload = validateCreateRepairJob(rawPayload);

    const createAttempt = () =>
      this.repository.transaction(async (repo) => {
        const customer = await repo.findCustomer(actor.branchId, payload.customerId);
        if (!customer) {
          throw new RepairError(
            RepairFailureCode.CUSTOMER_NOT_FOUND,
            'ไม่พบข้อมูลลูกค้าที่เข้าถึงได้ในสาขานี้',
            404
          );
        }

        let deviceId = null;
        if (payload.stockItemId) {
          const stockItem = await repo.findStockItemForIntake(payload.stockItemId);
          assertStockItemBranch(stockItem, actor.branchId);
          assertNoActiveRepair(stockItem);
          assertNoActiveClaim(stockItem);
          assertCustomerMatchesLatestSale(
            stockItem,
            payload.customerId,
            payload.allowCustomerOverride && actor.role === 'MANAGER'
          );
          deviceId = stockItem.devices?.[0]?.id || null;
        }

        if (payload.technicianId) {
          const technician = await repo.findTechnician(payload.technicianId);
          if (
            !technician ||
            Number(technician.branchId) !== Number(actor.branchId) ||
            !technician.active
          ) {
            throw new RepairError(
              RepairFailureCode.TECHNICIAN_NOT_FOUND,
              'ไม่พบช่างที่ใช้งานได้ในสาขานี้',
              404
            );
          }
        }

        const created = await repo.create({
          jobNo: createRepairJobNo(actor.branchId),
          branchId: actor.branchId,
          customerId: payload.customerId,
          stockItemId: payload.stockItemId,
          deviceId,
          deviceModel: payload.deviceModel,
          reportedSymptoms: payload.reportedSymptoms,
          technicianNotes: payload.technicianNotes,
          estimatedCost: payload.estimatedCost,
          depositPaid: payload.depositPaid,
          technicianId: payload.technicianId,
          status: 'RECEIVED',
        });

        if (created.deviceId && typeof repo.publishPassportEvent === 'function') {
          await repo.publishPassportEvent({
            deviceId: created.deviceId,
            branchId: created.branchId,
            eventType: 'REPAIR_CREATED',
            sourceType: 'REPAIR_JOB',
            sourceId: String(created.id),
            eventKey: `repair-job:${created.id}:created`,
            correlationId: `repair-job:${created.id}`,
            title: `เปิดใบงานซ่อม ${created.jobNo}`,
            description: created.reportedSymptoms,
            actorEmployeeId: actor.employeeId || null,
            customerVisible: true,
            metadata: {
              repairJobId: created.id,
              jobNo: created.jobNo,
              customerId: created.customerId,
              stockItemId: created.stockItemId,
              status: created.status,
              deviceModel: created.deviceModel,
              preAgreedService: payload.preAgreedService || null,
            },
            occurredAt: created.createdAt,
          });
        }

        return mapRepairJob(created);
      });

    try {
      return await createAttempt();
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;

      try {
        return await createAttempt();
      } catch (retryError) {
        if (isPrismaUniqueConflict(retryError)) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'ไม่สามารถสร้างเลขใบงานซ่อมที่ไม่ซ้ำได้ กรุณาลองใหม่',
            409
          );
        }
        throw retryError;
      }
    }
  }
}

module.exports = new CreateRepairJobService();
module.exports.CreateRepairJobService = CreateRepairJobService;
