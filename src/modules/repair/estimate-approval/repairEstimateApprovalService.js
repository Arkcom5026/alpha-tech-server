const trackingRepository = require('../customer-access/repairTrackingAccessRepository');
const repository = require('./repairEstimateApprovalRepository');
const {
  createHttpError,
  hashTrackingToken,
  validatePublishInput,
  validateDecisionInput,
  mapApproval,
} = require('./repairEstimateApprovalPolicy');
const {
  REPAIR_WORKFLOW_ACTION,
  REPAIR_WORKFLOW_STATUS,
  projectLegacyServiceStatus,
  resolveRepairWorkflowTransition,
} = require('../workflow/policies/repairWorkflowPolicy');

function workflowStatusFromEvent(event) {
  return event?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
}

function actionForDecision(decision) {
  return decision === 'APPROVED'
    ? REPAIR_WORKFLOW_ACTION.APPROVE_QUOTATION
    : REPAIR_WORKFLOW_ACTION.REJECT_QUOTATION;
}

class RepairEstimateApprovalService {
  constructor(repo = repository, trackingRepo = trackingRepository) {
    this.repository = repo;
    this.trackingRepository = trackingRepo;
  }

  async publish(actor, repairJobId, input = {}) {
    const job = await this.repository.findRepairJobForStaff(repairJobId, actor.branchId);
    if (!job) {
      throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
    }
    if (!job.deviceId) {
      throw createHttpError(
        409,
        'REPAIR_DEVICE_REQUIRED',
        'งานซ่อมนี้ยังไม่มี Device Passport จึงไม่สามารถส่งราคาใน workflow ใหม่ได้'
      );
    }
    const workflowEvent = await this.repository.findLatestWorkflowEvent({
      repairJobId: job.id,
      branchId: job.branchId,
      deviceId: job.deviceId,
    });
    const workflowStatus = workflowStatusFromEvent(workflowEvent);
    if (workflowStatus !== REPAIR_WORKFLOW_STATUS.WAITING_APPROVAL) {
      throw createHttpError(
        409,
        'REPAIR_NOT_WAITING_APPROVAL',
        'ต้องบันทึกผลวินิจฉัยให้เสร็จก่อนส่งราคาประเมินให้ลูกค้า',
        { workflowStatus }
      );
    }

    const snapshot = validatePublishInput(job, input);
    const created = await this.repository.transaction(async (repo) => {
      await repo.supersedePending(job.id);
      return repo.create({
        repairJobId: job.id,
        requestedByEmployeeId: actor.employeeId,
        ...snapshot,
      });
    });
    return {
      contractVersion: 'repair-estimate-approval.v2',
      repairJobId: job.id,
      jobNo: job.jobNo,
      workflowStatus,
      approval: mapApproval(created),
    };
  }

  async getLatestForStaff(actor, repairJobId) {
    const [job, latest] = await Promise.all([
      this.repository.findRepairJobForStaff(repairJobId, actor.branchId),
      this.repository.findLatest(repairJobId),
    ]);
    if (!job) {
      throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
    }
    return {
      repairJobId: job.id,
      jobNo: job.jobNo,
      approval: mapApproval(latest),
    };
  }

  async decideByTrackingToken(token, input = {}) {
    if (!token || typeof token !== 'string' || token.length < 32) {
      throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
    }
    const access = await this.trackingRepository.findValidByTokenHash(hashTrackingToken(token));
    if (!access) {
      throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
    }
    const decision = validateDecisionInput(input);

    const result = await this.repository.transaction(async (repo) => {
      const current = await repo.findById(decision.approvalId, access.repairJobId);
      if (!current) {
        throw createHttpError(404, 'ESTIMATE_APPROVAL_NOT_FOUND', 'ไม่พบคำขออนุมัติราคานี้');
      }
      if (current.status !== 'PENDING') {
        if (current.status === decision.decision) {
          return { approval: current, idempotent: true };
        }
        throw createHttpError(409, 'ESTIMATE_APPROVAL_ALREADY_DECIDED', 'คำขอราคานี้ได้รับการตอบกลับแล้ว');
      }
      if (current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now()) {
        throw createHttpError(409, 'ESTIMATE_APPROVAL_EXPIRED', 'คำขออนุมัติราคานี้หมดอายุแล้ว');
      }

      const job = await repo.findRepairJobWorkflowContext(access.repairJobId);
      if (!job || !job.deviceId) {
        throw createHttpError(
          409,
          'REPAIR_DEVICE_REQUIRED',
          'งานซ่อมนี้ไม่มี Device Passport สำหรับบันทึกผลการอนุมัติ'
        );
      }
      const workflowEvent = await repo.findLatestWorkflowEvent({
        repairJobId: job.id,
        branchId: job.branchId,
        deviceId: job.deviceId,
      });
      const workflowStatus = workflowStatusFromEvent(workflowEvent);
      if (workflowStatus !== REPAIR_WORKFLOW_STATUS.WAITING_APPROVAL) {
        throw createHttpError(
          409,
          'REPAIR_APPROVAL_WORKFLOW_CONFLICT',
          'สถานะงานซ่อมเปลี่ยนไปแล้ว กรุณาให้ร้านตรวจสอบก่อนตอบราคาอีกครั้ง',
          { workflowStatus }
        );
      }

      const updated = await repo.decide({
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

      const action = actionForDecision(decision.decision);
      const transition = resolveRepairWorkflowTransition(workflowStatus, action);
      const legacyStatus = projectLegacyServiceStatus(transition.targetStatus);
      await repo.updateRepairStatus(job.id, legacyStatus);
      const event = await repo.publishWorkflowEvent({
        deviceId: job.deviceId,
        branchId: job.branchId,
        eventType: 'REPAIR_STATUS_CHANGED',
        sourceType: 'REPAIR_JOB',
        sourceId: String(job.id),
        eventKey: `repair-estimate-decision:${job.id}:${updated.id}:${decision.decision}`,
        correlationId: `repair-job:${job.id}`,
        causationId: `estimate-approval:${updated.id}`,
        title:
          decision.decision === 'APPROVED'
            ? `งานซ่อม ${job.jobNo}: ลูกค้าอนุมัติราคาประเมิน`
            : `งานซ่อม ${job.jobNo}: ลูกค้าไม่อนุมัติราคาประเมิน`,
        description: decision.customerNote || null,
        customerVisible: true,
        metadata: {
          repairJobId: job.id,
          estimateApprovalId: Number(updated.id),
          decision: decision.decision,
          confirmedByName: decision.confirmedByName,
          workflowPreviousStatus: transition.previousStatus,
          workflowTargetStatus: transition.targetStatus,
          legacyServiceStatus: legacyStatus,
          customerNote: decision.customerNote,
        },
        occurredAt: new Date(),
      });

      return {
        approval: updated,
        idempotent: false,
        workflowStatus: transition.targetStatus,
        passportEventId: event.id,
      };
    });

    await this.trackingRepository.touch(access.id);
    const approval = mapApproval(result.approval);
    return {
      ...approval,
      workflowStatus:
        result.workflowStatus ||
        (approval.status === 'APPROVED'
          ? REPAIR_WORKFLOW_STATUS.APPROVED
          : approval.status === 'REJECTED'
            ? REPAIR_WORKFLOW_STATUS.REJECTED
            : null),
      passportEventId: result.passportEventId || null,
      idempotent: result.idempotent,
    };
  }
}

const service = new RepairEstimateApprovalService();

module.exports = {
  publish: service.publish.bind(service),
  getLatestForStaff: service.getLatestForStaff.bind(service),
  decideByTrackingToken: service.decideByTrackingToken.bind(service),
  RepairEstimateApprovalService,
  workflowStatusFromEvent,
  actionForDecision,
};
