const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const TERMINAL_CLAIM_STATUSES = new Set(['RESOLVED', 'CANCELLED']);

function activeWarrantyClaims(job) {
  return (job?.warrantyClaims || []).filter(
    (claim) => !TERMINAL_CLAIM_STATUSES.has(claim.status)
  );
}

function assertRepairCanComplete(job) {
  if (!job?.serviceAssetId) {
    throw new RepairError(
      RepairFailureCode.SERVICE_ASSET_REQUIRED,
      'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนปิดงาน',
      409
    );
  }

  const blockingClaims = activeWarrantyClaims(job);
  if (blockingClaims.length > 0) {
    throw new RepairError(
      RepairFailureCode.ACTIVE_CLAIM_BLOCKS_COMPLETION,
      'ไม่สามารถปิดงานซ่อมได้ เนื่องจากยังมีรายการเคลมที่ดำเนินการอยู่',
      409,
      {
        warrantyClaims: blockingClaims.map((claim) => ({
          id: claim.id,
          claimNo: claim.claimNo,
          status: claim.status,
        })),
      }
    );
  }
}

module.exports = {
  TERMINAL_CLAIM_STATUSES,
  activeWarrantyClaims,
  assertRepairCanComplete,
};
