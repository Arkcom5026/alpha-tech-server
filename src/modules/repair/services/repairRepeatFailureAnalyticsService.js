const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { repairWarrantyHistory, activeRepairWarranty } = require('./repairWarrantyService');
const { repeatRepairLinks } = require('./repairRepeatLinkService');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function hoursBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Number(((endDate - startDate) / 3600000).toFixed(2));
}

function normalizeSymptom(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRepeatFailureAnalytics(job, asset, relatedJobs = [], now = new Date()) {
  const metadata = metadataObject(asset.metadata);
  const links = repeatRepairLinks(metadata).filter(
    (link) => Number(link.repairJobId) === Number(job.id) || Number(link.previousRepairJobId) === Number(job.id)
  );
  const orderedJobs = [...relatedJobs]
    .filter((item) => Number(item.serviceAssetId) === Number(asset.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const currentIndex = orderedJobs.findIndex((item) => Number(item.id) === Number(job.id));
  const previousJob = currentIndex > 0 ? orderedJobs[currentIndex - 1] : null;
  const mtbfHours = previousJob ? hoursBetween(previousJob.createdAt, job.createdAt) : null;
  const sameSymptom = previousJob
    ? normalizeSymptom(previousJob.reportedSymptoms) === normalizeSymptom(job.reportedSymptoms)
    : false;
  const warranty = activeRepairWarranty(metadata, job.createdAt || now);
  const warranties = repairWarrantyHistory(metadata);

  return {
    repairJobId: Number(job.id),
    repairJobNo: job.jobNo || null,
    serviceAssetId: Number(asset.id),
    repairCountForAsset: orderedJobs.length,
    repeatRepair: links.length > 0 || currentIndex > 0,
    repeatLinks: links,
    previousRepairJob: previousJob
      ? {
          id: previousJob.id,
          jobNo: previousJob.jobNo,
          createdAt: previousJob.createdAt,
          reportedSymptoms: previousJob.reportedSymptoms,
          status: previousJob.status,
        }
      : null,
    failurePattern: {
      sameSymptomAsPrevious: sameSymptom,
      mtbfHours,
      mtbfDays: mtbfHours == null ? null : Number((mtbfHours / 24).toFixed(2)),
    },
    warrantyContext: {
      activeWarrantyAtReturn: warranty,
      returnedWithinRepairWarranty: Boolean(warranty),
      warrantyHistoryCount: warranties.length,
    },
    calculatedAt: now.toISOString(),
  };
}

class RepairRepeatFailureAnalyticsService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getForRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนวิเคราะห์งานซ่อมซ้ำ', 409);
    }
    const assetRepository = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }
    const relatedJobs = await this.repository.listRepairJobs(actor.branchId, {
      status: null,
      stockItemId: null,
      customerId: null,
      limit: 500,
      offset: 0,
    });
    return buildRepeatFailureAnalytics(job, asset, relatedJobs);
  }
}

module.exports = new RepairRepeatFailureAnalyticsService();
module.exports.RepairRepeatFailureAnalyticsService = RepairRepeatFailureAnalyticsService;
module.exports.buildRepeatFailureAnalytics = buildRepeatFailureAnalytics;
module.exports.normalizeSymptom = normalizeSymptom;
module.exports.hoursBetween = hoursBetween;
