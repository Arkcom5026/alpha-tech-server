const repository = require('./repairJobDetailRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');
const {
  REPAIR_WORKFLOW_STATUS,
  getAvailableRepairWorkflowActions,
} = require('../../workflow/policies/repairWorkflowPolicy');

function requirePositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

const NEXT_ACTION_BY_STATUS = Object.freeze({
  RECEIVED: 'ตรวจหลักฐานรับเครื่องให้ครบ แล้วส่งเข้าคิวตรวจวินิจฉัย',
  WAITING_DIAGNOSIS: 'เริ่มตรวจวินิจฉัยเมื่อช่างพร้อม',
  DIAGNOSING: 'บันทึกผลตรวจ สาเหตุ แนวทางแก้ และราคาประเมิน',
  WAITING_APPROVAL: 'ส่งราคาประเมินและรอการตัดสินใจจากลูกค้า',
  APPROVED: 'เริ่มงานซ่อมตามรายการที่ลูกค้าอนุมัติ',
  REJECTED: 'ทบทวนแนวทาง/ราคา แล้วเปิดวินิจฉัยใหม่หากต้องการเสนอทางเลือกใหม่',
  REPAIRING: 'ดำเนินการซ่อม บันทึกอะไหล่ และสรุปงานเมื่อเสร็จ',
  WAITING_PARTS: 'ติดตามอะไหล่ และกลับมาซ่อมต่อเมื่อพร้อม',
  WAITING_QC: 'ตรวจ QC ให้ครบทุกหัวข้อก่อนส่งมอบ',
  QC_FAILED: 'แก้ไขงานตามสาเหตุที่ QC ไม่ผ่าน แล้วส่งตรวจใหม่',
  READY_FOR_DELIVERY: 'รอลูกค้ายืนยันรับเครื่อง ตรวจ checklist และส่งมอบ',
  DELIVERED: 'ตรวจความเรียบร้อยแล้วปิดใบงาน',
  CLOSED: 'ใบงานเสร็จสมบูรณ์แล้ว',
  CANCELLED: 'ใบงานถูกยกเลิก ตรวจเหตุผลและประวัติได้จาก Timeline',
});

function mapHistory(event) {
  return {
    id: event.id,
    eventType: event.eventType,
    action: event.metadata?.action || null,
    previousStatus: event.metadata?.workflowPreviousStatus || null,
    status: event.metadata?.workflowTargetStatus || null,
    title: event.title,
    description: event.description || event.metadata?.note || null,
    occurredAt: event.occurredAt,
  };
}

class RepairJobDetailService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, repairJobIdInput) {
    const repairJobId = requirePositiveInteger(repairJobIdInput, 'repairJobId');
    const job = await this.repository.findById(actor.branchId, repairJobId);

    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }

    const workflowEvent = job.repairWorkflowEvent || null;
    const workflowStatus =
      workflowEvent?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
    const diagnosis = job.repairDiagnosisEvent?.metadata?.diagnosis || null;
    const history = (job.repairWorkflowHistory || []).map(mapHistory);

    return {
      ...mapRepairJob(job),
      workflow: {
        status: workflowStatus,
        nextAction: NEXT_ACTION_BY_STATUS[workflowStatus] || 'ตรวจสอบสถานะงานก่อนดำเนินการต่อ',
        availableActions: getAvailableRepairWorkflowActions(workflowStatus),
        latestEvent: workflowEvent
          ? {
              id: workflowEvent.id,
              eventType: workflowEvent.eventType,
              title: workflowEvent.title,
              description: workflowEvent.description,
              occurredAt: workflowEvent.occurredAt,
            }
          : null,
        diagnosis,
        history,
      },
    };
  }
}

module.exports = new RepairJobDetailService();
module.exports.RepairJobDetailService = RepairJobDetailService;
module.exports.requirePositiveInteger = requirePositiveInteger;
module.exports.NEXT_ACTION_BY_STATUS = NEXT_ACTION_BY_STATUS;
module.exports.mapHistory = mapHistory;
