const repairPartUsageRepository = require('../repositories/repairPartUsageRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const TERMINAL_REPAIR_STATUSES = Object.freeze([
  'COMPLETED',
  'RETURNED_TO_CUSTOMER',
  'CANCELLED',
]);

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

function partReversalHistory(metadata) {
  const history = metadataObject(metadata).repairPartReversals;
  return Array.isArray(history) ? history : [];
}

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

      const reversedAt = new Date().toISOString();
      const reversal = {
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        partItemId: part.id,
        productId: part.productId,
        productName: part.product?.name || null,
        quantity: Number(part.qtyUsed),
        unitPrice: Number(part.unitPrice),
        amount: Number((Number(part.qtyUsed) * Number(part.unitPrice)).toFixed(2)),
        reason: payload.reason,
        reversedByEmployeeId: actor.employeeId,
        reversedAt,
      };

      if (job.serviceAssetId) {
        const assetRepo = new ServiceAssetRepository(repo.prisma);
        const asset = await assetRepo.findServiceAsset(
          actor.branchId,
          job.serviceAssetId
        );
        if (!asset) {
          throw new RepairError(
            RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
            'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
            404
          );
        }

        const metadata = metadataObject(asset.metadata);
        const history = partReversalHistory(metadata);
        await assetRepo.updateServiceAsset(asset.id, {
          metadata: {
            ...metadata,
            repairPartReversals: [...history, reversal],
            latestRepairPartReversal: reversal,
          },
        });
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
        ...reversal,
        qtyRestored: reversal.quantity,
      };
    });
  }
}

module.exports = new RepairPartReversalService();
module.exports.RepairPartReversalService = RepairPartReversalService;
module.exports.validatePartReversal = validatePartReversal;
module.exports.metadataObject = metadataObject;
module.exports.partReversalHistory = partReversalHistory;
module.exports.TERMINAL_REPAIR_STATUSES = TERMINAL_REPAIR_STATUSES;
