const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  CLAIM_ACTIVE_STATUSES,
} = require('../contracts/repairContract');

const CLAIM_OPENABLE_WORKFLOW_STATUSES = Object.freeze([
  'DIAGNOSING',
  'WAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'REPAIRING',
  'WAITING_PARTS',
  'WAITING_QC',
  'QC_FAILED',
]);

function assertRepairCanOpenClaim(job, workflowStatus = null) {
  if (!job) {
    throw new RepairError(
      RepairFailureCode.REPAIR_JOB_NOT_FOUND,
      'ไม่พบใบงานซ่อมที่ต้องการเปิดเคลม',
      404
    );
  }

  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_JOB_TERMINAL,
      'ไม่สามารถเปิดเคลมจากงานซ่อมที่ปิดหรือยกเลิกแล้ว',
      409,
      { status: job.status }
    );
  }

  const hasStockIdentity = Boolean(job.stockItemId && job.stockItem);
  const hasDeviceIdentity = Boolean(job.deviceId && job.device);
  if (!hasStockIdentity && !hasDeviceIdentity) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_STOCK_ITEM_REQUIRED,
      'งานซ่อมนี้ยังไม่ได้ผูกกับ StockItem หรือ Device จึงยังเปิดเคลมไม่ได้',
      409
    );
  }

  if (!CLAIM_OPENABLE_WORKFLOW_STATUSES.includes(workflowStatus)) {
    throw new RepairError(
      RepairFailureCode.CONFLICT,
      'ยังไม่สามารถเปิดเคลมในขั้นตอนปัจจุบัน กรุณาตรวจวินิจฉัยงานก่อน หรือกลับมาดำเนินงานซ่อมให้ถึงขั้นที่รองรับการส่งเคลม',
      409,
      {
        workflowStatus: workflowStatus || 'RECEIVED',
        allowedWorkflowStatuses: CLAIM_OPENABLE_WORKFLOW_STATUSES,
      }
    );
  }
}

function assertNoActiveClaimForJob(job) {
  const active = (job.warrantyClaims || []).find((claim) =>
    CLAIM_ACTIVE_STATUSES.includes(claim.status)
  );

  if (active) {
    throw new RepairError(
      RepairFailureCode.ACTIVE_CLAIM_EXISTS,
      'งานซ่อมนี้มีเคลมที่กำลังดำเนินการอยู่แล้ว',
      409,
      {
        warrantyClaimId: active.id,
        claimNo: active.claimNo,
        status: active.status,
      }
    );
  }
}

function assertResolutionRequirements(update) {
  if (update.status !== 'RESOLVED') return;

  if (!update.resolution) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_RESOLUTION_REQUIRED,
      'กรุณาระบุผลการเคลมก่อนปิดรายการ',
      400
    );
  }

  if (update.resolution === 'REPLACED' && !update.replacementStockItemId) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_REPLACEMENT_REQUIRED,
      'ผลการเคลมแบบเปลี่ยนสินค้าใหม่ต้องระบุ replacementStockItemId',
      400
    );
  }

  if (update.resolution === 'CREDITED' && update.creditAmount === null) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_CREDIT_REQUIRED,
      'ผลการเคลมแบบรับเครดิตต้องระบุ creditAmount',
      400
    );
  }
}

module.exports = {
  CLAIM_OPENABLE_WORKFLOW_STATUSES,
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
  assertResolutionRequirements,
};
