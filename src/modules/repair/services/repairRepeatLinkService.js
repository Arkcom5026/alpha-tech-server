const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { activeRepairWarranty } = require('./repairWarrantyService');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function repeatRepairLinks(metadata) {
  const links = metadataObject(metadata).repeatRepairLinks;
  return Array.isArray(links) ? links : [];
}

function optionalText(value, maxLength = 4000) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `ข้อความยาวเกิน ${maxLength} ตัวอักษร`, 400);
  }
  return normalized || null;
}

class RepairRepeatLinkService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async link(actor, repairJobId, rawPayload = {}) {
    const previousRepairJobId = Number(rawPayload.previousRepairJobId);
    if (!Number.isInteger(previousRepairJobId) || previousRepairJobId <= 0) {
      throw new RepairError(
        RepairFailureCode.REPEAT_REPAIR_PREVIOUS_JOB_REQUIRED,
        'กรุณาระบุ previousRepairJobId ที่ถูกต้อง',
        400
      );
    }

    return this.repository.transaction(async (repo) => {
      const currentJob = await repo.findRepairJob(actor.branchId, repairJobId);
      const previousJob = await repo.findRepairJob(actor.branchId, previousRepairJobId);
      if (!currentJob || !previousJob) {
        throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
      }
      if (!currentJob.serviceAssetId || !previousJob.serviceAssetId) {
        throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมทั้งสองต้องเชื่อมกับอุปกรณ์บริการ', 409);
      }
      if (Number(currentJob.serviceAssetId) !== Number(previousJob.serviceAssetId)) {
        throw new RepairError(
          RepairFailureCode.REPEAT_REPAIR_ASSET_MISMATCH,
          'ใบงานซ่อมซ้ำต้องเป็นอุปกรณ์บริการเดียวกัน',
          409
        );
      }
      if (Number(currentJob.id) === Number(previousJob.id)) {
        throw new RepairError(RepairFailureCode.INVALID_INPUT, 'ไม่สามารถเชื่อมใบงานเข้าหาตัวเองได้', 400);
      }

      const assetRepository = new ServiceAssetRepository(repo.prisma);
      const asset = await assetRepository.findServiceAsset(actor.branchId, currentJob.serviceAssetId);
      if (!asset) {
        throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
      }

      const metadata = metadataObject(asset.metadata);
      const history = repeatRepairLinks(metadata);
      const existing = history.find((link) => Number(link.repairJobId) === Number(currentJob.id));
      if (existing) return { link: existing, idempotent: true };

      const activeWarranty = activeRepairWarranty(metadata);
      const link = {
        id: crypto.randomUUID(),
        repairJobId: currentJob.id,
        repairJobNo: currentJob.jobNo,
        previousRepairJobId: previousJob.id,
        previousRepairJobNo: previousJob.jobNo,
        serviceAssetId: asset.id,
        reason: optionalText(rawPayload.reason, 4000),
        symptomsComparison: optionalText(rawPayload.symptomsComparison, 4000),
        underRepairWarranty: Boolean(activeWarranty),
        repairWarrantyId: activeWarranty?.id || null,
        linkedByEmployeeId: actor.employeeId,
        linkedAt: new Date().toISOString(),
      };

      await assetRepository.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repeatRepairLinks: [...history, link],
          latestRepeatRepairLink: link,
        },
      });

      return { link, idempotent: false };
    });
  }
}

module.exports = new RepairRepeatLinkService();
module.exports.RepairRepeatLinkService = RepairRepeatLinkService;
module.exports.repeatRepairLinks = repeatRepairLinks;
