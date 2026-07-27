const trackingRepository = require('../customer-access/repairTrackingAccessRepository');
const repository = require('./repairEstimateApprovalRepository');
const {
  createHttpError,
  hashTrackingToken,
  validatePublishInput,
  validateDecisionInput,
  mapApproval,
} = require('./repairEstimateApprovalPolicy');

async function publish(actor, repairJobId, input = {}) {
  const job = await repository.findRepairJobForStaff(repairJobId, actor.branchId);
  if (!job) {
    throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
  }
  const snapshot = validatePublishInput(job, input);
  const created = await repository.transaction(async (repo) => {
    await repo.supersedePending(job.id);
    return repo.create({
      repairJobId: job.id,
      requestedByEmployeeId: actor.employeeId,
      ...snapshot,
    });
  });
  return {
    contractVersion: 'repair-estimate-approval.v1',
    repairJobId: job.id,
    jobNo: job.jobNo,
    approval: mapApproval(created),
  };
}

async function getLatestForStaff(actor, repairJobId) {
  const job = await repository.findRepairJobForStaff(repairJobId, actor.branchId);
  if (!job) {
    throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
  }
  return {
    repairJobId: job.id,
    jobNo: job.jobNo,
    approval: mapApproval(await repository.findLatest(job.id)),
  };
}

async function decideByTrackingToken(token, input = {}) {
  if (!token || typeof token !== 'string' || token.length < 32) {
    throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
  }
  const access = await trackingRepository.findValidByTokenHash(hashTrackingToken(token));
  if (!access) {
    throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
  }
  const decision = validateDecisionInput(input);
  const current = await repository.findById(decision.approvalId, access.repairJobId);
  if (!current) {
    throw createHttpError(404, 'ESTIMATE_APPROVAL_NOT_FOUND', 'ไม่พบคำขออนุมัติราคานี้');
  }
  if (current.status !== 'PENDING') {
    if (current.status === decision.decision) return mapApproval(current);
    throw createHttpError(409, 'ESTIMATE_APPROVAL_ALREADY_DECIDED', 'คำขอราคานี้ได้รับการตอบกลับแล้ว');
  }
  if (current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now()) {
    throw createHttpError(409, 'ESTIMATE_APPROVAL_EXPIRED', 'คำขออนุมัติราคานี้หมดอายุแล้ว');
  }
  const updated = await repository.decide({
    ...decision,
    repairJobId: access.repairJobId,
  });
  if (!updated) {
    throw createHttpError(
      409,
      'ESTIMATE_APPROVAL_STATE_CHANGED',
      'สถานะคำขอราคาเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่'
    );
  }
  await trackingRepository.touch(access.id);
  return mapApproval(updated);
}

module.exports = { publish, getLatestForStaff, decideByTrackingToken };
