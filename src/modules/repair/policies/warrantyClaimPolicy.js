const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  CLAIM_ACTIVE_STATUSES,
} = require('../contracts/repairContract');

function assertRepairCanOpenClaim(job) {
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

  if (!job.stockItemId || !job.stockItem) {
    throw new RepairError(
      RepairFailureCode.WARRANTY_STOCK_ITEM_REQUIRED,
      'งานซ่อมนี้ยังไม่ได้ผูกกับสินค้าที่มีตัวตนในสต็อก จึงยังเปิดเคลมไม่ได้',
      409
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
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
  assertResolutionRequirements,
};
