const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { partReservationHistory } = require('./repairPartReservationService');

const REQUIRED_CHECKS = Object.freeze([
  'DIAGNOSIS_CONFIRMED',
  'REPAIR_RESULT_VERIFIED',
  'DEVICE_POWER_ON_TESTED',
  'ACCESSORIES_RECONCILED',
  'CUSTOMER_DATA_HANDLING_CONFIRMED',
]);

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function getCompletionChecklist(job) {
  const metadata = normalizeMetadata(job?.metadata);
  const checklist = metadata.completionChecklist;
  return checklist && typeof checklist === 'object' && !Array.isArray(checklist)
    ? checklist
    : null;
}

function buildCompletionReadiness(job) {
  const metadata = normalizeMetadata(job?.metadata);
  const checklist = getCompletionChecklist(job);
  const checks = checklist?.checks || {};
  const missingChecks = REQUIRED_CHECKS.filter((key) => checks[key] !== true);
  const technicianVerified = Boolean(checklist?.technicianVerifiedAt);
  const qcPassed = checklist?.qcResult === 'PASSED';
  const finalReportReady = Boolean(checklist?.finalReport?.summary);
  const openPartReservations = partReservationHistory(metadata).filter(
    (item) =>
      Number(item.repairJobId) === Number(job.id) && item.status === 'RESERVED'
  );
  const partsReconciled = openPartReservations.length === 0;
  const ready =
    missingChecks.length === 0 &&
    technicianVerified &&
    qcPassed &&
    finalReportReady &&
    partsReconciled;

  return {
    repairJobId: Number(job.id),
    repairJobNo: job.jobNo || null,
    status: job.status,
    checklist,
    requirements: {
      requiredChecks: REQUIRED_CHECKS,
      missingChecks,
      technicianVerified,
      qcPassed,
      finalReportReady,
      partsReconciled,
      openPartReservations: openPartReservations.map((item) => ({
        reservationId: item.id,
        productId: item.productId,
        productName: item.productName || null,
        quantity: Number(item.quantity || 0),
        reservedAt: item.reservedAt || null,
      })),
    },
    readyForCompletion: ready,
  };
}

class RepairCompletionReadinessService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getReadiness(actor, repairJobId) {
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
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนตรวจความพร้อมปิดงาน',
        409
      );
    }
    const assetRepository = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepository.findServiceAsset(
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
    return buildCompletionReadiness({ ...job, metadata: asset.metadata });
  }
}

module.exports = new RepairCompletionReadinessService();
module.exports.RepairCompletionReadinessService = RepairCompletionReadinessService;
module.exports.REQUIRED_CHECKS = REQUIRED_CHECKS;
module.exports.buildCompletionReadiness = buildCompletionReadiness;
module.exports.getCompletionChecklist = getCompletionChecklist;
