const repairPartUsageRepository = require('../repositories/repairPartUsageRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const TERMINAL_REPAIR_STATUSES = Object.freeze([
  'COMPLETED',
  'RETURNED_TO_CUSTOMER',
  'CANCELLED',
]);

function validatePartReversal(payload = {}) {
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (!reason) {
    throw new RepairError(
      RepairFailureCode.REPAIR_PART_REVERSAL_REASON_REQUIRED,
      'กรุณาระบุเหตุผลในการคืนอะไหล่เข้าสต็อก',
      400
    );
  }
  if (reason.length > 2000) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'เหตุผลในการคืนอะไหล่ยาวเกิน 2000 ตัวอักษร',
      400
    );
  }
  return { reason };
}

class RepairPartReversalService {
  constructor(repository = repairPartUsageRepository) {
    this.repository = repository;
  }

  async reversePartUsage(actor, repairJobId, partItemId, rawPayload) {
    const payload = validatePartReversal(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      if (TERMINAL_REPAIR_STATUSES.includes(job.status)) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_TERMINAL,
          'ไม่สามารถคืนอะไหล่จากใบงานที่ปิด ส่งคืนลูกค้า หรือยกเลิกแล้ว',
          409
        );
      }

      const part = await repo.findPartUsage(job.id, partItemId);
      if (!part) {
        throw new RepairError(
          RepairFailureCode.REPAIR_PART_NOT_FOUND,
          'ไม่พบรายการอะไหล่ในใบงานซ่อมนี้',
          404
        );
      }

      await repo.restoreStock(actor.branchId, part.productId, part.qtyUsed);
      await repo.createStockMovement({
        productId: part.productId,
        branchId: actor.branchId,
        qty: Number(part.qtyUsed),
        type: 'ADJUST',
        refType: 'REPAIR_JOB_PART_REVERSAL',
        refId: job.id,
        note: `คืนอะไหล่จากใบงานซ่อม ${job.jobNo}: ${payload.reason}`,
        performedByEmployeeId: actor.employeeId,
      });
      await repo.deletePartUsage(part.id);

      return {
        repairJobId: job.id,
        partItemId: part.id,
        productId: part.productId,
        productName: part.product?.name || null,
        qtyRestored: Number(part.qtyUsed),
        reason: payload.reason,
      };
    });
  }
}

module.exports = new RepairPartReversalService();
module.exports.RepairPartReversalService = RepairPartReversalService;
module.exports.validatePartReversal = validatePartReversal;
module.exports.TERMINAL_REPAIR_STATUSES = TERMINAL_REPAIR_STATUSES;
