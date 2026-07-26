const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { validateRepairDiagnosis } = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

function diagnosisHistory(metadata) {
  const history = metadataObject(metadata).repairDiagnoses;
  return Array.isArray(history) ? history : [];
}

class RepairDiagnosisService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async listForRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }

    if (!job.serviceAssetId) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_REQUIRED,
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนบันทึกผลตรวจ',
        409
      );
    }

    const assetRepo = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepo.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
        'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
        404
      );
    }

    return diagnosisHistory(asset.metadata).filter(
      (item) => Number(item.repairJobId) === Number(job.id)
    );
  }

  async record(actor, repairJobId, rawPayload) {
    const payload = validateRepairDiagnosis(rawPayload);

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
          'ไม่สามารถบันทึกผลตรวจให้ใบงานที่เสร็จสิ้นหรือยกเลิกแล้ว',
          409,
          { currentStatus: job.status }
        );
      }

      if (!job.serviceAssetId) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_REQUIRED,
          'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนบันทึกผลตรวจ',
          409
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

      const existingMetadata = metadataObject(asset.metadata);
      const history = diagnosisHistory(existingMetadata);
      const diagnosedAt = new Date().toISOString();
      const diagnosis = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        conclusion: payload.conclusion,
        findings: payload.findings,
        rootCause: payload.rootCause,
        recommendedAction: payload.recommendedAction,
        note: payload.note,
        diagnosedByEmployeeId: actor.employeeId,
        diagnosedAt,
      };

      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...existingMetadata,
          repairDiagnoses: [...history, diagnosis],
          latestRepairDiagnosis: diagnosis,
        },
      });

      return diagnosis;
    });
  }
}

module.exports = new RepairDiagnosisService();
module.exports.RepairDiagnosisService = RepairDiagnosisService;
module.exports.diagnosisHistory = diagnosisHistory;
