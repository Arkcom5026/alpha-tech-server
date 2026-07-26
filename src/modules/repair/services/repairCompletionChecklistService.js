const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { REQUIRED_CHECKS, buildCompletionReadiness } = require('./repairCompletionReadinessService');

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function optionalText(value, maxLength = 4000) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairError(RepairFailureCode.INVALID_INPUT, `ข้อความยาวเกิน ${maxLength} ตัวอักษร`, 400);
  }
  return normalized || null;
}

function validateCompletionChecklist(payload = {}) {
  const rawChecks = payload.checks;
  if (!rawChecks || typeof rawChecks !== 'object' || Array.isArray(rawChecks)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_COMPLETION_CHECKLIST_INVALID,
      'กรุณาระบุรายการตรวจสอบก่อนปิดงานซ่อม',
      400
    );
  }

  const checks = Object.fromEntries(
    REQUIRED_CHECKS.map((key) => [key, rawChecks[key] === true])
  );
  const qcResult = String(payload.qcResult || '').trim().toUpperCase();
  if (!['PASSED', 'FAILED'].includes(qcResult)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_QC_RESULT_INVALID,
      'ผล QC ต้องเป็น PASSED หรือ FAILED',
      400,
      { qcResult }
    );
  }

  const summary = optionalText(payload.finalReport?.summary, 4000);
  if (!summary) {
    throw new RepairError(
      RepairFailureCode.REPAIR_FINAL_REPORT_REQUIRED,
      'กรุณาระบุสรุปผลการซ่อมขั้นสุดท้าย',
      400
    );
  }

  return {
    checks,
    qcResult,
    qcNote: optionalText(payload.qcNote, 4000),
    finalReport: {
      summary,
      workPerformed: optionalText(payload.finalReport?.workPerformed, 4000),
      testResult: optionalText(payload.finalReport?.testResult, 4000),
      customerAdvice: optionalText(payload.finalReport?.customerAdvice, 4000),
    },
  };
}

class RepairCompletionChecklistService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async record(actor, repairJobId, rawPayload) {
    const payload = validateCompletionChecklist(rawPayload);
    return this.repository.transaction(async (repo) => {
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
          'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนบันทึกผลตรวจปิดงาน',
          409
        );
      }

      const assetRepository = new ServiceAssetRepository(repo.prisma);
      const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
      if (!asset) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
          'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
          404
        );
      }

      const now = new Date().toISOString();
      const completionChecklist = {
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        ...payload,
        technicianVerifiedAt: now,
        technicianVerifiedByEmployeeId: actor.employeeId,
        recordedAt: now,
      };
      const metadata = metadataObject(asset.metadata);
      await assetRepository.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          completionChecklist,
          latestRepairFinalReport: completionChecklist.finalReport,
        },
      });

      const projectedJob = {
        ...job,
        metadata: {
          ...metadata,
          completionChecklist,
        },
      };
      return buildCompletionReadiness(projectedJob);
    });
  }
}

module.exports = new RepairCompletionChecklistService();
module.exports.RepairCompletionChecklistService = RepairCompletionChecklistService;
module.exports.validateCompletionChecklist = validateCompletionChecklist;
