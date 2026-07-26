const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function positiveWarrantyDays(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
    throw new RepairError(
      RepairFailureCode.REPAIR_WARRANTY_PERIOD_INVALID,
      'ระยะเวลารับประกันงานซ่อมต้องเป็นจำนวนเต็ม 1-3650 วัน',
      400,
      { warrantyDays: value }
    );
  }
  return parsed;
}

function optionalText(value, maxLength = 4000) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `ข้อความยาวเกิน ${maxLength} ตัวอักษร`, 400);
  }
  return normalized || null;
}

function repairWarrantyHistory(metadata) {
  const history = metadataObject(metadata).repairWarranties;
  return Array.isArray(history) ? history : [];
}

function warrantyIsActive(warranty, at = new Date()) {
  const now = at instanceof Date ? at : new Date(at);
  const expiresAt = new Date(warranty?.expiresAt);
  return (
    warranty?.status === 'ACTIVE' &&
    !Number.isNaN(now.getTime()) &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt >= now
  );
}

function activeRepairWarrantyForJob(metadata, repairJobId, at = new Date()) {
  return (
    repairWarrantyHistory(metadata)
      .filter(
        (warranty) =>
          Number(warranty.repairJobId) === Number(repairJobId) &&
          warrantyIsActive(warranty, at)
      )
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null
  );
}

function activeRepairWarranty(metadata, at = new Date()) {
  return (
    repairWarrantyHistory(metadata)
      .filter((warranty) => warrantyIsActive(warranty, at))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null
  );
}

class RepairWarrantyService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async listForRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการ', 409);
    }
    const assetRepository = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }
    const warranties = repairWarrantyHistory(asset.metadata).filter(
      (warranty) => Number(warranty.repairJobId) === Number(job.id)
    );
    return {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      warranties,
      activeWarranty: activeRepairWarrantyForJob(asset.metadata, job.id),
    };
  }

  async issueForRepairJob(actor, repairJobId, rawPayload = {}) {
    const warrantyDays = positiveWarrantyDays(rawPayload.warrantyDays);
    const coverageNote = optionalText(rawPayload.coverageNote, 4000);
    const exclusionNote = optionalText(rawPayload.exclusionNote, 4000);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
      }
      if (job.status !== 'COMPLETED') {
        throw new RepairError(
          RepairFailureCode.REPAIR_WARRANTY_REQUIRES_COMPLETION,
          'ต้องปิดงานซ่อมเป็น COMPLETED ก่อนเริ่มรับประกันงานซ่อม',
          409,
          { currentStatus: job.status }
        );
      }
      if (!job.serviceAssetId) {
        throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการ', 409);
      }

      const assetRepository = new ServiceAssetRepository(repo.prisma);
      const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
      if (!asset) {
        throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
      }

      const metadata = metadataObject(asset.metadata);
      const history = repairWarrantyHistory(metadata);
      const existing = history.find(
        (warranty) => Number(warranty.repairJobId) === Number(job.id) && warranty.status === 'ACTIVE'
      );
      if (existing) {
        return { warranty: existing, idempotent: true };
      }

      const startedAt = rawPayload.startedAt ? new Date(rawPayload.startedAt) : new Date();
      if (Number.isNaN(startedAt.getTime())) {
        throw new RepairError(RepairFailureCode.INVALID_INPUT, 'startedAt ต้องเป็นวันที่ที่ถูกต้อง', 400);
      }
      const expiresAt = new Date(startedAt);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + warrantyDays);

      const warranty = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        serviceAssetId: asset.id,
        warrantyDays,
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        coverageNote,
        exclusionNote,
        status: 'ACTIVE',
        issuedByEmployeeId: actor.employeeId,
        issuedAt: new Date().toISOString(),
      };

      await assetRepository.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairWarranties: [...history, warranty],
          activeRepairWarranty: warranty,
        },
      });

      return { warranty, idempotent: false };
    });
  }
}

module.exports = new RepairWarrantyService();
module.exports.RepairWarrantyService = RepairWarrantyService;
module.exports.repairWarrantyHistory = repairWarrantyHistory;
module.exports.warrantyIsActive = warrantyIsActive;
module.exports.activeRepairWarrantyForJob = activeRepairWarrantyForJob;
module.exports.activeRepairWarranty = activeRepairWarranty;
module.exports.positiveWarrantyDays = positiveWarrantyDays;
