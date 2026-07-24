const repairRepository = require('../repositories/repairRepository');
const {
  validateCreateRepairJob,
  validateRepairStatusUpdate,
  validateAddPart,
  validateListQuery,
} = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  assertStockItemBranch,
  assertNoActiveRepair,
  assertNoActiveClaim,
  assertCustomerMatchesLatestSale,
} = require('../policies/repairIntakePolicy');
const {
  assertRepairTransition,
} = require('../policies/repairTransitionPolicy');
const { createRepairJobNo } = require('../utils/repairCode');
const { mapRepairJob } = require('../mappers/repairMapper');

function isPrismaUniqueConflict(error) {
  return error && error.code === 'P2002';
}

class RepairService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async createRepairJob(actor, rawPayload) {
    const payload = validateCreateRepairJob(rawPayload);

    const createAttempt = async () =>
      this.repository.transaction(async (repo) => {
        const customer = await repo.findCustomer(payload.customerId);
        if (!customer) {
          throw new RepairError(
            RepairFailureCode.CUSTOMER_NOT_FOUND,
            'ไม่พบข้อมูลลูกค้าในระบบ',
            404
          );
        }

        let stockItem = null;
        if (payload.stockItemId) {
          stockItem = await repo.findStockItemByIdForIntake(payload.stockItemId);
          assertStockItemBranch(stockItem, actor.branchId);
          assertNoActiveRepair(stockItem);
          assertNoActiveClaim(stockItem);
          assertCustomerMatchesLatestSale(
            stockItem,
            payload.customerId,
            payload.allowCustomerOverride && actor.role === 'MANAGER'
          );
        }

        if (payload.technicianId) {
          const technician = await repo.findEmployee(payload.technicianId);
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

        const created = await repo.createRepairJob({
          jobNo: createRepairJobNo(actor.branchId),
          branchId: actor.branchId,
          customerId: payload.customerId,
          stockItemId: payload.stockItemId,
          deviceModel: payload.deviceModel,
          reportedSymptoms: payload.reportedSymptoms,
          technicianNotes: payload.technicianNotes,
          estimatedCost: payload.estimatedCost,
          depositPaid: payload.depositPaid,
          technicianId: payload.technicianId,
          status: 'RECEIVED',
        });

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

  async getRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }
    return mapRepairJob(job);
  }

  async listRepairJobs(actor, query) {
    const filters = validateListQuery(query);
    const jobs = await this.repository.listRepairJobs(actor.branchId, filters);
    return jobs.map(mapRepairJob);
  }

  async updateJobStatus(actor, repairJobId, rawPayload) {
    const payload = validateRepairStatusUpdate(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      assertRepairTransition(job.status, payload.status);

      if (payload.technicianId) {
        const technician = await repo.findEmployee(payload.technicianId);
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

      const updated = await repo.updateRepairJob(job.id, {
        status: payload.status,
        ...(payload.technicianNotes !== null
          ? { technicianNotes: payload.technicianNotes }
          : {}),
        ...(payload.technicianId ? { technicianId: payload.technicianId } : {}),
      });

      return mapRepairJob(updated);
    });
  }

  async addPartsToRepairJob(actor, repairJobId, rawPayload) {
    const payload = validateAddPart(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_TERMINAL,
          'ไม่สามารถเบิกอะไหล่ให้ใบงานที่ปิดหรือยกเลิกแล้ว',
          409
        );
      }

      const product = await repo.findProduct(payload.productId);
      if (!product || !product.active) {
        throw new RepairError(
          RepairFailureCode.PART_PRODUCT_NOT_FOUND,
          'ไม่พบสินค้าอะไหล่ที่ใช้งานได้',
          404
        );
      }

      const stockBalance = await repo.findStockBalance(
        actor.branchId,
        payload.productId
      );

      if (
        !stockBalance ||
        Number(stockBalance.quantity) < payload.qtyUsed
      ) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'จำนวนอะไหล่คงเหลือในสาขาไม่เพียงพอ',
          409,
          {
            available: stockBalance ? Number(stockBalance.quantity) : 0,
            requested: payload.qtyUsed,
          }
        );
      }

      const branchPrice = await repo.findBranchPrice(
        actor.branchId,
        payload.productId
      );
      const unitPrice = Number(
        branchPrice?.priceTechnician ??
          branchPrice?.priceRetail ??
          branchPrice?.costPrice ??
          stockBalance.avgCost ??
          0
      );

      const part = await repo.createRepairPart({
        repairJobId: job.id,
        productId: payload.productId,
        qtyUsed: payload.qtyUsed,
        unitPrice,
      });

      await repo.decrementStockBalance(
        actor.branchId,
        payload.productId,
        payload.qtyUsed
      );

      await repo.createStockMovement({
        productId: payload.productId,
        branchId: actor.branchId,
        qty: -payload.qtyUsed,
        type: 'ADJUST',
        refType: 'REPAIR_JOB_PART_USAGE',
        refId: job.id,
        note: `เบิกอะไหล่สำหรับใบงานซ่อม ${job.jobNo}`,
        performedByEmployeeId: actor.employeeId,
      });

      return {
        id: part.id,
        repairJobId: part.repairJobId,
        productId: part.productId,
        productName: part.product?.name || null,
        qtyUsed: part.qtyUsed,
        unitPrice: Number(part.unitPrice),
      };
    });
  }
}

module.exports = new RepairService();
module.exports.RepairService = RepairService;
