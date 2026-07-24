const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const REPAIR_TRANSITIONS = Object.freeze({
  RECEIVED: ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
});

const CLAIM_TRANSITIONS = Object.freeze({
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_TRANSIT', 'RECEIVED_BY_PROVIDER', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED_BY_PROVIDER', 'CANCELLED'],
  RECEIVED_BY_PROVIDER: ['INSPECTING', 'APPROVED', 'REJECTED'],
  INSPECTING: [
    'APPROVED',
    'REJECTED',
    'REPAIRING',
    'REPLACEMENT_PENDING',
    'CREDIT_PENDING',
  ],
  APPROVED: ['REPAIRING', 'REPLACEMENT_PENDING', 'CREDIT_PENDING', 'RESOLVED'],
  REJECTED: ['RESOLVED'],
  REPAIRING: ['RESOLVED'],
  REPLACEMENT_PENDING: ['RESOLVED'],
  CREDIT_PENDING: ['RESOLVED'],
  RESOLVED: [],
  CANCELLED: [],
});

function assertRepairTransition(currentStatus, nextStatus) {
  const allowed = REPAIR_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new RepairError(
      RepairFailureCode.INVALID_REPAIR_TRANSITION,
      `ไม่สามารถเปลี่ยนสถานะงานซ่อมจาก ${currentStatus} เป็น ${nextStatus} ได้`,
      409,
      { currentStatus, nextStatus, allowed }
    );
  }
}

function assertClaimTransition(currentStatus, nextStatus) {
  const allowed = CLAIM_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new RepairError(
      RepairFailureCode.INVALID_CLAIM_TRANSITION,
      `ไม่สามารถเปลี่ยนสถานะเคลมจาก ${currentStatus} เป็น ${nextStatus} ได้`,
      409,
      { currentStatus, nextStatus, allowed }
    );
  }
}

module.exports = {
  REPAIR_TRANSITIONS,
  CLAIM_TRANSITIONS,
  assertRepairTransition,
  assertClaimTransition,
};
