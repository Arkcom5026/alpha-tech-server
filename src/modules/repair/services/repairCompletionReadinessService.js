const repairRepository = require('../repositories/repairRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');

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
  const checklist = getCompletionChecklist(job);
  const checks = checklist?.checks || {};
  const missingChecks = REQUIRED_CHECKS.filter((key) => checks[key] !== true);
  const technicianVerified = Boolean(checklist?.technicianVerifiedAt);
  const qcPassed = checklist?.qcResult === 'PASSED';
  const finalReportReady = Boolean(checklist?.finalReport?.summary);
  const ready = missingChecks.length === 0 && technicianVerified && qcPassed && finalReportReady;

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
    return buildCompletionReadiness(job);
  }
}

module.exports = new RepairCompletionReadinessService();
module.exports.RepairCompletionReadinessService = RepairCompletionReadinessService;
module.exports.REQUIRED_CHECKS = REQUIRED_CHECKS;
module.exports.buildCompletionReadiness = buildCompletionReadiness;
module.exports.getCompletionChecklist = getCompletionChecklist;
