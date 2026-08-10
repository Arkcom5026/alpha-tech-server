const repository = require('./addRepairPartRepository');
const { validateAddPart } = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

function positiveRepairJobId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'repairJobId ต้องเป็นจำนวนเต็มมากกว่า 0',
      400,
      { field: 'repairJobId' }
    );
  }
  return parsed;
}

function currentWorkflowStatus(event) {
  return event?.metadata?.workflowTargetStatus || 'RECEIVED';
}

class AddRepairPartService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawRepairJobId, rawPayload) {
    const repairJobId = positiveRepairJobId(rawRepairJobId);
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

      const workflowEvent = job.deviceId
        ? await repo.findLatestWorkflowEvent(actor.branchId, job.id, job.deviceId)
        : null;
      const workflowStatus = currentWorkflowStatus(workflowEvent);
      if (workflowStatus !== 'REPAIRING') {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'เบิกอะไหล่ได้เฉพาะขณะงานอยู่ในขั้นกำลังซ่อม',
          409,
          { workflowStatus, requiredWorkflowStatus: 'REPAIRING' }
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
      const available = stockBalance ? Number(stockBalance.quantity) : 0;
      if (!stockBalance || available < payload.qtyUsed) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'จำนวนอะไหล่คงเหลือในสาขาไม่เพียงพอ',
          409,
          { available, requested: payload.qtyUsed }
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

module.exports = new AddRepairPartService();
module.exports.AddRepairPartService = AddRepairPartService;
module.exports.currentWorkflowStatus = currentWorkflowStatus;
