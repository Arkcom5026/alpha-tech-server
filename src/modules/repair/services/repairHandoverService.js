const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { validateRepairHandover } = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { mapRepairJob } = require('../mappers/repairMapper');
const { mapServiceAsset } = require('../mappers/serviceAssetMapper');

const TERMINAL_CLAIM_STATUSES = new Set(['RESOLVED', 'CANCELLED']);

function activeWarrantyClaims(job) {
  return (job.warrantyClaims || []).filter(
    (claim) => !TERMINAL_CLAIM_STATUSES.has(claim.status)
  );
}

function handoverMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

class RepairHandoverService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async handoverToCustomer(actor, repairJobId, rawPayload) {
    const payload = validateRepairHandover(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      if (job.status !== 'COMPLETED') {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_READY_FOR_HANDOVER,
          'ต้องเปลี่ยนงานซ่อมเป็นสถานะ COMPLETED ก่อนส่งคืนเครื่องให้ลูกค้า',
          409,
          { currentStatus: job.status, requiredStatus: 'COMPLETED' }
        );
      }

      if (!job.serviceAssetId) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_REQUIRED,
          'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนส่งคืนลูกค้า',
          409
        );
      }

      const blockingClaims = activeWarrantyClaims(job);
      if (blockingClaims.length > 0) {
        throw new RepairError(
          RepairFailureCode.ACTIVE_CLAIM_BLOCKS_HANDOVER,
          'ไม่สามารถส่งคืนเครื่องได้ เนื่องจากยังมีรายการเคลมที่ดำเนินการอยู่',
          409,
          {
            warrantyClaims: blockingClaims.map((claim) => ({
              id: claim.id,
              claimNo: claim.claimNo,
              status: claim.status,
            })),
          }
        );
      }

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

      const existingMetadata = handoverMetadata(asset.metadata);
      const existingHandover = existingMetadata.lastCustomerHandover;
      if (
        asset.status === 'RETURNED_TO_CUSTOMER' &&
        existingHandover &&
        Number(existingHandover.repairJobId) === Number(job.id)
      ) {
        return {
          repairJob: mapRepairJob(job),
          serviceAsset: mapServiceAsset(asset),
          handover: existingHandover,
          idempotent: true,
        };
      }

      const handedOverAt = new Date();
      const handover = {
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        handedOverAt: handedOverAt.toISOString(),
        handedOverByEmployeeId: actor.employeeId,
        note: payload.note,
      };

      const updatedAsset = await assetRepo.updateServiceAsset(asset.id, {
        status: 'RETURNED_TO_CUSTOMER',
        metadata: {
          ...existingMetadata,
          lastCustomerHandover: handover,
        },
      });

      return {
        repairJob: mapRepairJob(job),
        serviceAsset: mapServiceAsset(updatedAsset),
        handover,
        idempotent: false,
      };
    });
  }
}

module.exports = new RepairHandoverService();
module.exports.RepairHandoverService = RepairHandoverService;
module.exports.activeWarrantyClaims = activeWarrantyClaims;
