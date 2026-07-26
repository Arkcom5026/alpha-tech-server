const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { CLAIM_ACTIVE_STATUSES } = require('../contracts/repairContract');
const { estimateHistory } = require('../services/repairEstimateService');

const EXECUTION_AUTHORIZATION_TYPES = Object.freeze([
  'CUSTOMER_APPROVED',
  'WARRANTY_CLAIM',
  'NO_CHARGE',
]);

const ACTIVE_CLAIM_STATUSES = new Set(CLAIM_ACTIVE_STATUSES);
const EXECUTION_ELIGIBLE_CLAIM_LINK_STATES = new Set([
  'LINKED',
  'LINKED_VERIFIED',
]);

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
}

function approvedEstimateForJob(metadata, repairJobId) {
  return (
    estimateHistory(metadataObject(metadata))
      .filter((item) => Number(item.repairJobId) === Number(repairJobId))
      .reverse()
      .find((item) => item.status === 'APPROVED') || null
  );
}

function activeWarrantyClaim(job) {
  return (
    (job.warrantyClaims || []).find(
      (claim) =>
        EXECUTION_ELIGIBLE_CLAIM_LINK_STATES.has(claim.repairLinkState) &&
        ACTIVE_CLAIM_STATUSES.has(claim.status)
    ) || null
  );
}

function assertRepairExecutionAuthorized({
  job,
  asset,
  authorizationType,
  reason,
}) {
  if (!EXECUTION_AUTHORIZATION_TYPES.includes(authorizationType)) {
    throw new RepairError(
      RepairFailureCode.REPAIR_EXECUTION_AUTHORIZATION_REQUIRED,
      'ต้องระบุสิทธิ์อนุญาตก่อนเริ่มซ่อมหรือเบิกอะไหล่',
      409,
      { allowed: EXECUTION_AUTHORIZATION_TYPES }
    );
  }

  if (authorizationType === 'CUSTOMER_APPROVED') {
    const estimate = approvedEstimateForJob(asset.metadata, job.id);
    if (!estimate) {
      throw new RepairError(
        RepairFailureCode.APPROVED_REPAIR_ESTIMATE_REQUIRED,
        'ต้องมีใบเสนอราคาที่ลูกค้าอนุมัติก่อนเริ่มซ่อมหรือเบิกอะไหล่',
        409
      );
    }
    return { type: authorizationType, estimateId: estimate.id, reason: null };
  }

  if (authorizationType === 'WARRANTY_CLAIM') {
    const claim = activeWarrantyClaim(job);
    if (!claim) {
      throw new RepairError(
        RepairFailureCode.ACTIVE_WARRANTY_CLAIM_REQUIRED,
        'ต้องมีรายการเคลมที่เชื่อมกับใบงานและยังดำเนินการอยู่',
        409
      );
    }
    return {
      type: authorizationType,
      warrantyClaimId: claim.id,
      reason: reason || null,
    };
  }

  if (!reason) {
    throw new RepairError(
      RepairFailureCode.REPAIR_EXECUTION_REASON_REQUIRED,
      'กรณีดำเนินงานโดยไม่คิดค่าใช้จ่ายต้องระบุเหตุผล',
      400
    );
  }

  return { type: authorizationType, reason };
}

module.exports = {
  EXECUTION_AUTHORIZATION_TYPES,
  EXECUTION_ELIGIBLE_CLAIM_LINK_STATES,
  assertRepairExecutionAuthorized,
  approvedEstimateForJob,
  activeWarrantyClaim,
};
