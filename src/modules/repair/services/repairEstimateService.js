const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  validateRepairEstimate,
  validateRepairEstimateDecision,
} = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { diagnosisHistory } = require('./repairDiagnosisService');

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
}

function estimateHistory(metadata) {
  const history = metadataObject(metadata).repairEstimates;
  return Array.isArray(history) ? history : [];
}

function totalOf(items) {
  return Number(items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2));
}

class RepairEstimateService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async loadContext(repo, actor, repairJobId) {
    const job = await repo.findRepairJob(actor.branchId, repairJobId);
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
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนจัดทำใบเสนอราคา',
        409
      );
    }
    const assetRepo = new ServiceAssetRepository(repo.prisma);
    const asset = await assetRepo.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
        'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
        404
      );
    }
    return { job, asset, assetRepo };
  }

  async listForRepairJob(actor, repairJobId) {
    const { job, asset } = await this.loadContext(this.repository, actor, repairJobId);
    return estimateHistory(asset.metadata).filter(
      (item) => Number(item.repairJobId) === Number(job.id)
    );
  }

  async create(actor, repairJobId, rawPayload) {
    const payload = validateRepairEstimate(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_TERMINAL,
          'ไม่สามารถจัดทำใบเสนอราคาให้ใบงานที่เสร็จสิ้นหรือยกเลิกแล้ว',
          409
        );
      }

      const metadata = metadataObject(asset.metadata);
      const diagnoses = diagnosisHistory(metadata).filter(
        (item) => Number(item.repairJobId) === Number(job.id)
      );
      const diagnosis = diagnoses.find((item) => item.id === payload.diagnosisId);
      if (!diagnosis) {
        throw new RepairError(
          RepairFailureCode.REPAIR_DIAGNOSIS_REQUIRED,
          'ไม่พบผลตรวจที่ใช้อ้างอิงสำหรับใบเสนอราคานี้',
          409,
          { diagnosisId: payload.diagnosisId }
        );
      }

      const estimates = estimateHistory(metadata);
      const active = estimates.find(
        (item) =>
          Number(item.repairJobId) === Number(job.id) &&
          item.status === 'PENDING_APPROVAL'
      );
      if (active) {
        throw new RepairError(
          RepairFailureCode.ACTIVE_REPAIR_ESTIMATE_EXISTS,
          'มีใบเสนอราคาที่รอการตัดสินใจอยู่แล้ว',
          409,
          { estimateId: active.id }
        );
      }

      const createdAt = new Date().toISOString();
      const estimate = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        diagnosisId: diagnosis.id,
        diagnosisConclusion: diagnosis.conclusion,
        status: 'PENDING_APPROVAL',
        currency: 'THB',
        items: payload.items,
        subtotal: totalOf(payload.items),
        total: totalOf(payload.items),
        note: payload.note,
        validUntil: payload.validUntil ? payload.validUntil.toISOString() : null,
        createdByEmployeeId: actor.employeeId,
        createdAt,
        decidedAt: null,
        decidedByName: null,
        decisionNote: null,
      };

      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairEstimates: [...estimates, estimate],
          latestRepairEstimate: estimate,
        },
      });
      await repo.updateRepairJob(job.id, { estimatedCost: estimate.total });
      return estimate;
    });
  }

  async decide(actor, repairJobId, estimateId, rawPayload) {
    const payload = validateRepairEstimateDecision(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      const metadata = metadataObject(asset.metadata);
      const estimates = estimateHistory(metadata);
      const index = estimates.findIndex(
        (item) =>
          item.id === estimateId && Number(item.repairJobId) === Number(job.id)
      );
      if (index < 0) {
        throw new RepairError(
          RepairFailureCode.REPAIR_ESTIMATE_NOT_FOUND,
          'ไม่พบใบเสนอราคาของใบงานซ่อมนี้',
          404
        );
      }
      const current = estimates[index];
      if (current.status !== 'PENDING_APPROVAL') {
        throw new RepairError(
          RepairFailureCode.REPAIR_ESTIMATE_ALREADY_DECIDED,
          'ใบเสนอราคานี้ถูกตัดสินใจแล้ว',
          409,
          { currentStatus: current.status }
        );
      }
      const updated = {
        ...current,
        status: payload.decision,
        decidedAt: new Date().toISOString(),
        decidedByName: payload.decidedByName,
        decisionNote: payload.note,
        recordedByEmployeeId: actor.employeeId,
      };
      const next = [...estimates];
      next[index] = updated;
      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairEstimates: next,
          latestRepairEstimate: updated,
        },
      });
      return updated;
    });
  }
}

module.exports = new RepairEstimateService();
module.exports.RepairEstimateService = RepairEstimateService;
module.exports.estimateHistory = estimateHistory;
